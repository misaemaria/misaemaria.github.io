// Janela da música na home: mostra letra, origem e "Tocar" por cima da
// lista, sem sair da página — assim a playlist do rodapé continua tocando.
// A página própria de cada música (musicas/*.html) continua existindo para
// links diretos, Google e Ctrl+clique. O endereço ganha ?musica=<slug>, então
// dá pra compartilhar, recarregar e usar o botão Voltar do navegador.
(function (global) {
  'use strict';

  var getSongs = function () { return global.SONGS || []; };
  var onFavChange = function () {};
  var sheet = null, current = null, pushed = false, lastFocus = null;
  var baseTitle = document.title;

  function slugify(value) {
    var text = String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'musica';
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function findById(id) { return getSongs().find(function (s) { return s.id === id; }) || null; }
  function findBySlug(slug) { return getSongs().find(function (s) { return slugify(s.nome || 'Sem título') === slug; }) || null; }

  function build() {
    sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.hidden = true;
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.innerHTML = '<div class="sheet-panel"><div class="sheet-body"></div></div>';
    sheet.addEventListener('click', function (e) { if (e.target === sheet) close(); });
    document.body.appendChild(sheet);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) close(); });
    global.addEventListener('playlist:change', paintPlay);
  }

  function render(song) {
    var songs = getSongs();
    var i = songs.indexOf(song);
    var prev = i > 0 ? songs[i - 1] : null;
    var next = i !== -1 && i < songs.length - 1 ? songs[i + 1] : null;
    var fav = global.Favorites ? global.Favorites.isFavorite(song.id) : false;

    var body = sheet.querySelector('.sheet-body');
    body.innerHTML =
      '<div class="sheet-top">' +
        '<button type="button" class="sheet-back">← Voltar para a lista</button>' +
        '<a class="sheet-page" href="musicas/' + slugify(song.nome || 'Sem título') + '.html">Página da música</a>' +
      '</div>' +
      '<article class="song-page">' +
        '<div class="song-title-row">' +
          '<h1 id="sheetTitle">' + esc(song.nome || 'Sem título') + '</h1>' +
          '<button type="button" class="fav-btn song-fav' + (fav ? ' active' : '') + '" aria-label="' + (fav ? 'Remover dos favoritos' : 'Adicionar aos favoritos') + '">' + (fav ? '♥' : '♡') + '</button>' +
        '</div>' +
        (song.compositor ? '<div class="sheet-composer">' + esc(song.compositor) + '</div>' : '') +
        '<div class="field-label">Tocar</div>' +
        (song.audio
          ? '<button type="button" class="sheet-play"></button>'
          : '<p class="no-audio">Ainda sem áudio enviado para esta música.</p>') +
        (song.descricao ? '<div class="field-label">Sobre</div><p>' + esc(song.descricao) + '</p>' : '') +
        (song.videoFonte ? '<div class="field-label">Origem</div><a class="srclink" href="' + esc(song.videoFonte) + '" target="_blank" rel="noopener">▶ Ver o vídeo que gerou essa música</a>' : '') +
        '<div class="field-label">Letra</div>' +
        '<div class="lyrics">' + esc(song.letra || '') + '</div>' +
        ((prev || next) ? '<nav class="song-nav">' +
          (prev ? '<a class="prev" href="#" data-id="' + prev.id + '">← ' + esc(prev.nome || 'Sem título') + '</a>' : '') +
          (next ? '<a class="next" href="#" data-id="' + next.id + '">' + esc(next.nome || 'Sem título') + ' →</a>' : '') +
        '</nav>' : '') +
      '</article>';

    sheet.setAttribute('aria-labelledby', 'sheetTitle');
    body.querySelector('.sheet-back').addEventListener('click', close);
    body.querySelector('.song-fav').addEventListener('click', function (e) {
      if (!global.Favorites) return;
      var now = global.Favorites.toggleFavorite(song.id);
      e.currentTarget.classList.toggle('active', now);
      e.currentTarget.textContent = now ? '♥' : '♡';
      e.currentTarget.setAttribute('aria-label', now ? 'Remover dos favoritos' : 'Adicionar aos favoritos');
      onFavChange();
    });
    var playBtn = body.querySelector('.sheet-play');
    if (playBtn) {
      playBtn.addEventListener('click', function () {
        var P = global.Playlist;
        if (!P) return;
        if (P.currentId() === song.id && P.isPlaying()) P.pause();
        else P.playSong(song.id);
      });
    }
    body.querySelectorAll('.song-nav a').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        show(findById(Number(a.getAttribute('data-id'))), 'replace');
      });
    });
    sheet.querySelector('.sheet-panel').scrollTop = 0;
    paintPlay();
  }

  function paintPlay() {
    if (!sheet || sheet.hidden || !current) return;
    var btn = sheet.querySelector('.sheet-play');
    if (!btn) return;
    var P = global.Playlist;
    var playing = !!(P && P.currentId() === current.id && P.isPlaying());
    btn.textContent = playing ? '⏸ Pausar' : '▶ Tocar agora';
    btn.classList.toggle('is-playing', playing);
  }

  // mode: 'push' (abriu pela lista), 'replace' (anterior/próxima), 'none' (veio do endereço/Voltar)
  function show(song, mode) {
    if (!song) return;
    if (!sheet) build();
    var wasHidden = sheet.hidden;
    if (wasHidden) lastFocus = document.activeElement;
    current = song;
    render(song);
    sheet.hidden = false;
    document.body.classList.add('sheet-open');
    document.title = (song.nome || 'Sem título') + ' | Arquivo Misa & Maria';

    var url = '?musica=' + slugify(song.nome || 'Sem título');
    try {
      if (mode === 'push') { history.pushState({ musica: song.id }, '', url); pushed = true; }
      else if (mode === 'replace') history.replaceState({ musica: song.id }, '', url);
    } catch (e) {}

    if (global.Views) global.Views.hit(slugify(song.nome || 'Sem título'));
    if (wasHidden) sheet.querySelector('.sheet-back').focus();
  }

  function hide() {
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true;
    current = null;
    document.body.classList.remove('sheet-open');
    document.title = baseTitle;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function close() {
    if (!sheet || sheet.hidden) return;
    // Se a janela foi aberta pela lista, volta no histórico (o popstate fecha);
    // se veio de um link com ?musica=, só limpa o endereço.
    if (pushed) { pushed = false; history.back(); return; }
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
    hide();
  }

  global.addEventListener('popstate', function (e) {
    var id = e.state && e.state.musica;
    if (id != null) { pushed = true; show(findById(id), 'none'); }
    else { pushed = false; hide(); }
  });

  // O nome da música na barra da playlist também abre a janela.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('.player-title');
    if (!a || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || !global.Playlist) return;
    var id = global.Playlist.currentId();
    if (id == null) return;
    e.preventDefault();
    if (!current || current.id !== id) show(findById(id), current ? 'replace' : 'push');
  });

  function init(opts) {
    if (opts && opts.getSongs) getSongs = opts.getSongs;
    if (opts && opts.onFavChange) onFavChange = opts.onFavChange;
    var slug = new URLSearchParams(location.search).get('musica');
    if (slug) show(findBySlug(slug), 'none');
  }

  global.SongSheet = { init: init, open: function (id) { show(findById(id), current ? 'replace' : 'push'); }, close: close };
})(window);
