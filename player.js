// Playlist da home: barra fixa no rodapé que toca as músicas na ordem da
// lista (mais ouvidas primeiro). Os navegadores não deixam um site tocar som
// sozinho antes de a pessoa interagir, então: tenta tocar ao abrir e, se for
// barrado, começa no primeiro toque/clique/tecla em qualquer ponto da página
// (menos em links, pra não soar um pedacinho e já mudar de página).
(function (global) {
  'use strict';

  var STATE_KEY = 'playlist_state';   // { id, time } pra retomar ao voltar de uma música
  var PAUSED_KEY = 'playlist_paused'; // pausou de propósito: não volta a tocar sozinho nesta sessão
  var VOLUME_KEY = 'playlist_volume'; // { v, muted } — guardado entre visitas

  var queue = [];
  var index = 0;
  var ready = false;
  var wantPlay = false;
  var resumeTime = 0;
  var started = false; // já tocou alguma vez nesta página

  var audio = new Audio();
  audio.preload = 'none';

  var bar, titleEl, playBtn, progressEl, fillEl, timeEl;

  function readSession(key) { try { return sessionStorage.getItem(key); } catch (e) { return null; } }
  function writeSession(key, val) { try { if (val == null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, val); } catch (e) {} }

  function slugify(value) {
    var text = String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'musica';
  }

  function fmt(t) {
    if (!isFinite(t) || t < 0) t = 0;
    var m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  function current() { return queue[index] || null; }

  function buildBar() {
    bar = document.createElement('div');
    bar.className = 'player';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Playlist');
    bar.innerHTML =
      '<div class="player-inner">' +
        '<div class="player-btns">' +
          '<button type="button" class="pl-prev" aria-label="Música anterior">⏮</button>' +
          '<button type="button" class="pl-play" aria-label="Tocar">▶</button>' +
          '<button type="button" class="pl-next" aria-label="Próxima música">⏭</button>' +
        '</div>' +
        '<div class="player-info">' +
          '<div class="player-label">Playlist · mais ouvidas primeiro</div>' +
          '<a class="player-title" href="#"></a>' +
          '<div class="player-progress" role="slider" aria-label="Posição na música" tabindex="0"><div class="player-fill"></div></div>' +
        '</div>' +
        '<div class="player-time">0:00</div>' +
        '<div class="player-vol">' +
          '<button type="button" class="pl-mute" aria-label="Silenciar"></button>' +
          '<input type="range" class="pl-vol" min="0" max="1" step="0.01" aria-label="Volume">' +
        '</div>' +
      '</div>';
    document.body.appendChild(bar);
    document.body.classList.add('has-player');

    titleEl = bar.querySelector('.player-title');
    playBtn = bar.querySelector('.pl-play');
    progressEl = bar.querySelector('.player-progress');
    fillEl = bar.querySelector('.player-fill');
    timeEl = bar.querySelector('.player-time');
    setupVolume(bar.querySelector('.pl-mute'), bar.querySelector('.pl-vol'));

    playBtn.addEventListener('click', function () {
      if (audio.paused) { writeSession(PAUSED_KEY, null); play(); }
      else { writeSession(PAUSED_KEY, '1'); audio.pause(); }
    });
    bar.querySelector('.pl-prev').addEventListener('click', function () {
      if (audio.currentTime > 3) { audio.currentTime = 0; return; }
      go(index - 1, true);
    });
    bar.querySelector('.pl-next').addEventListener('click', function () { go(index + 1, true); });
    progressEl.addEventListener('click', function (e) {
      if (!audio.duration) return;
      var r = progressEl.getBoundingClientRect();
      audio.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * audio.duration;
    });
    progressEl.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
      if (e.key === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
    });
  }

  var SPEAKER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/>';
  var ICON_VOL = SPEAKER + '<path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  var ICON_LOW = SPEAKER + '<path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>';
  var ICON_MUTE = SPEAKER + '<path d="m16 9 5 6"/><path d="m21 9-5 6"/></svg>';

  // Volume e mudo ficam salvos no navegador, pra valer na próxima visita.
  // (No iPhone o volume só muda pelos botões do aparelho; o mudo funciona.)
  function setupVolume(muteBtn, slider) {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(VOLUME_KEY) || 'null'); } catch (e) {}
    if (saved && typeof saved.v === 'number') audio.volume = Math.max(0, Math.min(1, saved.v));
    audio.muted = !!(saved && saved.muted);

    function paint() {
      var shown = audio.muted ? 0 : audio.volume;
      slider.value = String(shown);
      slider.style.setProperty('--vol', (shown * 100) + '%');
      muteBtn.innerHTML = shown === 0 ? ICON_MUTE : (shown < 0.5 ? ICON_LOW : ICON_VOL);
      muteBtn.setAttribute('aria-label', audio.muted ? 'Tirar do mudo' : 'Silenciar');
      try { localStorage.setItem(VOLUME_KEY, JSON.stringify({ v: audio.volume, muted: audio.muted })); } catch (e) {}
    }
    slider.addEventListener('input', function () {
      var v = parseFloat(slider.value);
      audio.volume = v;
      audio.muted = v === 0;
      paint();
    });
    muteBtn.addEventListener('click', function () {
      // Tirar do mudo com o volume zerado volta pra metade, senão nada muda.
      if (audio.muted && audio.volume === 0) audio.volume = 0.5;
      audio.muted = !audio.muted;
      paint();
    });
    paint();
  }

  function updateUi() {
    var song = current();
    if (!bar) return;
    bar.hidden = !song;
    if (!song) return;
    titleEl.textContent = song.nome || 'Sem título';
    titleEl.href = 'musicas/' + slugify(song.nome || 'Sem título') + '.html';
    playBtn.textContent = audio.paused ? '▶' : '⏸';
    playBtn.setAttribute('aria-label', audio.paused ? 'Tocar' : 'Pausar');
    bar.classList.toggle('waiting', audio.paused && !readSession(PAUSED_KEY));
    markList();
    // Avisa quem mostra o estado da playlist fora da barra (a janela da música).
    try { global.dispatchEvent(new CustomEvent('playlist:change')); } catch (e) {}
    if ('mediaSession' in navigator && global.MediaMetadata) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: song.nome || '', artist: song.compositor || 'Misa & Maria', album: 'Arquivo Misa & Maria' });
    }
  }

  // Destaca na lista a música que está tocando (main.js redesenha a lista
  // ao buscar/filtrar, por isso também é chamado de lá).
  function markList() {
    var song = current();
    var playingId = song && !audio.paused ? String(song.id) : '';
    document.querySelectorAll('.track[data-id]').forEach(function (el) {
      el.classList.toggle('playing', el.getAttribute('data-id') === playingId);
    });
  }

  function load(i) {
    if (!queue.length) return;
    index = (i + queue.length) % queue.length;
    audio.src = current().audio;
  }

  function go(i, andPlay) {
    load(i);
    if (andPlay) play(); else updateUi();
  }

  function play() {
    if (!current()) return Promise.resolve(false);
    if (!audio.src) load(index);
    var p = audio.play();
    return (p && p.then ? p : Promise.resolve()).then(function () { return true; }, function () { return false; });
  }

  function armFirstInteraction() {
    function onFirst(e) {
      if (e.target.closest && (e.target.closest('a') || e.target.closest('.player') || e.target.closest('input'))) return;
      cleanup();
      if (readSession(PAUSED_KEY) || !audio.paused) return;
      wantPlay = true;
      if (ready) play();
    }
    function cleanup() {
      document.removeEventListener('pointerdown', onFirst, true);
      document.removeEventListener('keydown', onFirst, true);
    }
    document.addEventListener('pointerdown', onFirst, true);
    document.addEventListener('keydown', onFirst, true);
  }

  // Define a fila. Chamado pela home com a ordem atual da lista; a ordem
  // final (por acessos) chega depois, com final = true.
  function setQueue(songs, final) {
    var playing = current();
    queue = songs.filter(function (s) { return s.audio; });
    if (!bar) buildBar();

    if (started && playing) {
      // Já tocou: continua na mesma música, só a ordem das próximas muda.
      var keep = queue.findIndex(function (s) { return s.id === playing.id; });
      if (keep !== -1) index = keep;
    } else {
      // Ainda não tocou: começa pela primeira da ordem atual, ou retoma a
      // música de antes de a pessoa abrir uma página de música.
      var saved = null;
      try { saved = JSON.parse(readSession(STATE_KEY) || 'null'); } catch (e) {}
      var start = saved ? queue.findIndex(function (s) { return s.id === saved.id; }) : -1;
      if (queue.length) load(start === -1 ? 0 : start);
      resumeTime = start !== -1 ? (saved.time || 0) : 0;
    }

    if (final && !ready) {
      ready = true;
      if (!readSession(PAUSED_KEY)) {
        play().then(function (ok) { if (!ok && wantPlay) play(); });
      }
    }
    updateUi();
  }

  audio.addEventListener('loadedmetadata', function () {
    if (resumeTime) { audio.currentTime = Math.min(resumeTime, audio.duration || resumeTime); resumeTime = 0; }
  });
  audio.addEventListener('play', function () { started = true; updateUi(); });
  audio.addEventListener('pause', updateUi);
  audio.addEventListener('ended', function () { go(index + 1, true); });
  audio.addEventListener('error', function () {
    // Áudio quebrado/ausente: pula pra próxima, sem entrar em loop se todas falharem.
    if (queue.length > 1 && !audio.paused) go(index + 1, true);
  });
  audio.addEventListener('timeupdate', function () {
    if (!fillEl) return;
    var d = audio.duration || 0;
    fillEl.style.width = d ? (audio.currentTime / d * 100) + '%' : '0';
    timeEl.textContent = fmt(audio.currentTime) + (d ? ' / ' + fmt(d) : '');
  });

  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('previoustrack', function () { go(index - 1, true); });
      navigator.mediaSession.setActionHandler('nexttrack', function () { go(index + 1, true); });
    } catch (e) {}
  }

  global.addEventListener('pagehide', function () {
    var song = current();
    if (song && !audio.paused) writeSession(STATE_KEY, JSON.stringify({ id: song.id, time: audio.currentTime }));
    else writeSession(STATE_KEY, null);
  });

  armFirstInteraction();

  global.Playlist = {
    setQueue: setQueue,
    markList: markList,
    pause: function () { audio.pause(); },
    isPlaying: function () { return !audio.paused; },
    resume: function () { return play(); },
    // Toca uma música específica (botão "Tocar" na janela da música).
    playSong: function (id) {
      var i = queue.findIndex(function (s) { return s.id === id; });
      if (i === -1) return;
      writeSession(PAUSED_KEY, null);
      if (i === index && audio.src) { play(); return; }
      go(i, true);
    },
    currentId: function () { var s = current(); return s ? s.id : null; }
  };
})(window);
