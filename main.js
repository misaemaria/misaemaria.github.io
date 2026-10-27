(function () {
  'use strict';

  var songs = (window.SONGS || []).slice().sort(function (a, b) { return (b.id || 0) - (a.id || 0); });
  var query = '';
  var onlyFavorites = false;

  var listEl = document.getElementById('list');
  var countEl = document.getElementById('countLabel');
  var searchInput = document.getElementById('searchInput');
  var favFilterBtn = document.getElementById('favFilterBtn');

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function matches(song, q) {
    if (!q) return true;
    var hay = ((song.nome || '') + ' ' + (song.letra || '')).toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function render() {
    var q = query.trim().toLowerCase();
    var favs = window.Favorites ? window.Favorites.getFavorites() : [];
    var filtered = songs.filter(function (s) {
      if (onlyFavorites && favs.indexOf(s.id) === -1) return false;
      return matches(s, q);
    });

    countEl.textContent = songs.length === 0 ? '' :
      (filtered.length + ' de ' + songs.length + ' música' + (songs.length === 1 ? '' : 's'));

    if (songs.length === 0) {
      listEl.innerHTML = '<div class="empty"><div class="ico">🎶</div><h3>Ainda sem músicas</h3>' +
        '<p>Em breve o arquivo é preenchido pelo admin.</p></div>';
      return;
    }

    if (filtered.length === 0) {
      var emptyMsg = onlyFavorites
        ? '<div class="empty"><div class="ico">♡</div><h3>Nenhuma favorita ainda</h3><p>Toca no coração de uma música pra guardá-la aqui.</p></div>'
        : '<div class="empty"><div class="ico">🔍</div><h3>Nada encontrado</h3><p>Tenta outro termo de busca.</p></div>';
      listEl.innerHTML = emptyMsg;
      return;
    }

    listEl.innerHTML = '';
    filtered.forEach(function (song, idx) {
      listEl.appendChild(renderTrack(song, idx + 1));
    });
    if (window.Playlist) window.Playlist.markList();
  }

  function slugifyText(value) {
    var text = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'musica';
  }

  function renderTrack(song, num) {
    var titleSlug = slugifyText(song.nome || 'Sem título');
    var fav = window.Favorites ? window.Favorites.isFavorite(song.id) : false;

    var wrap = document.createElement('div');
    wrap.className = 'track';
    wrap.setAttribute('data-id', String(song.id));

    var link = document.createElement('a');
    link.className = 'track-link';
    link.href = 'musicas/' + titleSlug + '.html';
    link.innerHTML =
      '<span class="track-num">' + String(num).padStart(2, '0') + '</span>' +
      '<span class="track-main">' +
        '<div class="track-title">' + esc(song.nome || 'Sem título') + '</div>' +
      '</span>' +
      '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg>';
    wrap.appendChild(link);

    var favBtn = document.createElement('button');
    favBtn.type = 'button';
    favBtn.className = 'fav-btn' + (fav ? ' active' : '');
    favBtn.setAttribute('aria-label', fav ? 'Remover dos favoritos' : 'Adicionar aos favoritos');
    favBtn.textContent = fav ? '♥' : '♡';
    favBtn.addEventListener('click', function () {
      if (!window.Favorites) return;
      var nowFav = window.Favorites.toggleFavorite(song.id);
      favBtn.classList.toggle('active', nowFav);
      favBtn.textContent = nowFav ? '♥' : '♡';
      favBtn.setAttribute('aria-label', nowFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos');
      if (onlyFavorites && !nowFav) render();
    });
    wrap.appendChild(favBtn);

    return wrap;
  }

  searchInput.addEventListener('input', function (e) {
    query = e.target.value;
    render();
  });

  favFilterBtn.addEventListener('click', function () {
    onlyFavorites = !onlyFavorites;
    favFilterBtn.classList.toggle('active', onlyFavorites);
    favFilterBtn.setAttribute('aria-pressed', String(onlyFavorites));
    render();
  });

  render();
  if (window.Playlist) window.Playlist.setQueue(songs, false);

  // A playlist segue a mesma ordem da lista. Ela só começa depois que a
  // ordem por acessos chegar (ou falhar), pra abrir pela mais ouvida.
  function finalizeQueue() {
    if (window.Playlist) window.Playlist.setQueue(songs, true);
  }
  // Se o contador de acessos demorar, não segura a playlist pra sempre.
  setTimeout(finalizeQueue, 4000);

  // Reordena por acessos assim que os números chegarem — até lá, fica na
  // ordem padrão (mais recente primeiro) pra não deixar a lista em branco.
  if (window.Views) {
    var slugs = songs.map(function (s) { return slugifyText(s.nome || 'Sem título'); });
    window.Views.getAll(slugs).then(function (counts) {
      songs.sort(function (a, b) {
        var ca = counts[slugifyText(a.nome || 'Sem título')] || 0;
        var cb = counts[slugifyText(b.nome || 'Sem título')] || 0;
        if (cb !== ca) return cb - ca;
        return (b.id || 0) - (a.id || 0);
      });
      render();
      finalizeQueue();
    }).catch(finalizeQueue);
  } else {
    finalizeQueue();
  }
})();
