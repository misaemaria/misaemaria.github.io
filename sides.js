// Laterais da home: vídeos dos canais do YouTube (esquerda, de videos.js,
// atualizado pelo workflow a cada hora) e postagens do Instagram (direita,
// de instagram.js, escolhidas pelo admin).
(function () {
  'use strict';

  var INSTAGRAM_PROFILE = 'https://www.instagram.com/misaemaria/';

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function ago(iso) {
    var diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (!isFinite(diff)) return '';
    if (diff < 3600) return 'há ' + Math.max(1, Math.round(diff / 60)) + ' min';
    if (diff < 86400) return 'há ' + Math.round(diff / 3600) + ' h';
    var days = Math.round(diff / 86400);
    if (days < 30) return 'há ' + days + (days === 1 ? ' dia' : ' dias');
    return new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
  }

  // ---- vídeos ----
  var videosEl = document.getElementById('videosList');
  var videos = window.VIDEOS || [];
  if (videosEl) {
    if (!videos.length) {
      videosEl.innerHTML = '<p class="side-empty">Os vídeos aparecem aqui em breve.</p>';
    } else {
      videos.forEach(function (v) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'video';
        btn.innerHTML =
          '<span class="video-thumb"><img loading="lazy" alt="" src="https://i.ytimg.com/vi/' + encodeURIComponent(v.id) + '/mqdefault.jpg">' +
            '<span class="video-play">▶</span></span>' +
          '<span class="video-meta">' +
            '<span class="video-title">' + esc(v.titulo) + '</span>' +
            '<span class="video-sub"><span class="tag' + (v.canal === 'Cortes' ? ' tag-cortes' : '') + '">' + esc(v.canal) + '</span> ' + esc(ago(v.publicado)) + '</span>' +
          '</span>';
        btn.addEventListener('click', function () { openVideo(v); });
        videosEl.appendChild(btn);
      });
    }
  }

  // Janela com o vídeo por cima da página. Pausa a playlist enquanto o
  // vídeo está aberto e retoma ao fechar, se ela estava tocando.
  var modal = null, resumeAfter = false, lastFocus = null;
  function openVideo(v) {
    lastFocus = document.activeElement;
    resumeAfter = !!(window.Playlist && window.Playlist.isPlaying());
    if (resumeAfter) window.Playlist.pause();
    modal = document.createElement('div');
    modal.className = 'video-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', v.titulo);
    modal.innerHTML =
      '<div class="video-box">' +
        '<button type="button" class="video-close" aria-label="Fechar">✕</button>' +
        '<div class="video-frame' + (v.short ? ' is-short' : '') + '"><iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(v.id) + '?autoplay=1&rel=0" title="' + esc(v.titulo) + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>' +
        '<div class="video-caption">' + esc(v.titulo) + ' · <a href="https://www.youtube.com/watch?v=' + encodeURIComponent(v.id) + '" target="_blank" rel="noopener">abrir no YouTube</a></div>' +
      '</div>';
    modal.addEventListener('click', function (e) { if (e.target === modal) closeVideo(); });
    modal.querySelector('.video-close').addEventListener('click', closeVideo);
    document.body.appendChild(modal);
    document.addEventListener('keydown', onEsc);
    modal.querySelector('.video-close').focus();
  }
  function closeVideo() {
    if (!modal) return;
    modal.remove();
    modal = null;
    document.removeEventListener('keydown', onEsc);
    if (resumeAfter && window.Playlist) window.Playlist.resume();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function onEsc(e) { if (e.key === 'Escape') closeVideo(); }

  // ---- Instagram ----
  var instaEl = document.getElementById('instaList');
  var posts = window.INSTAGRAM || [];
  if (instaEl) {
    if (!posts.length) {
      instaEl.innerHTML = '<p class="side-empty">Siga <a href="' + INSTAGRAM_PROFILE + '" target="_blank" rel="noopener">@misaemaria</a> no Instagram.</p>';
    } else {
      posts.forEach(function (url) {
        var q = document.createElement('blockquote');
        q.className = 'instagram-media';
        q.setAttribute('data-instgrm-permalink', url);
        q.setAttribute('data-instgrm-version', '14');
        q.innerHTML = '<a href="' + esc(url) + '" target="_blank" rel="noopener">Ver no Instagram</a>';
        instaEl.appendChild(q);
      });
      // Embed oficial do Instagram: troca cada blockquote pela postagem.
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.instagram.com/embed.js';
      document.body.appendChild(s);
    }
  }
})();
