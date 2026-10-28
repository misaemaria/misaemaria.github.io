// "Sugerir correção da letra": o visitante edita a letra numa janela e o
// pedido vai para o Supabase (tabela correcoes). O admin vê, compara e aplica
// na aba "Correções". Usado na janela da música (song-sheet.js) e nas páginas
// próprias de cada música (musicas/*.html).
(function (global) {
  'use strict';

  var COOLDOWN_KEY = 'lyricfix_last';
  var COOLDOWN_MS = 60 * 1000;
  var modal = null, song = null;

  function cfg() {
    var c = global.MISA_SUPABASE || {};
    return c.url && c.key ? c : null;
  }

  function headers(c) {
    // Só apikey: serve tanto para a chave anon antiga quanto para a publishable nova.
    return { apikey: c.key, 'Content-Type': 'application/json' };
  }

  // Uma consulta leve por visita, para o projeto grátis do Supabase não
  // pausar por falta de uso. As regras do banco devolvem lista vazia.
  function ping() {
    var c = cfg();
    if (!c) return;
    try { if (sessionStorage.getItem('lyricfix_ping')) return; sessionStorage.setItem('lyricfix_ping', '1'); } catch (e) {}
    fetch(c.url + '/rest/v1/correcoes?select=id&limit=1', { headers: headers(c) }).catch(function () {});
  }

  function build() {
    modal = document.createElement('div');
    modal.className = 'fix-modal';
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'fixTitle');
    modal.innerHTML =
      '<form class="fix-panel">' +
        '<div class="fix-head">' +
          '<h2 id="fixTitle">Sugerir correção</h2>' +
          '<button type="button" class="fix-close" aria-label="Fechar">✕</button>' +
        '</div>' +
        '<p class="fix-song"></p>' +
        '<p class="fix-hint">Corrija direto no texto abaixo. O pedido vai para quem cuida do site, que confere antes de mudar.</p>' +
        '<label class="field-label" for="fixLetra">Letra</label>' +
        '<textarea id="fixLetra" class="fix-letra" rows="12" maxlength="20000" required></textarea>' +
        '<label class="field-label" for="fixComentario">O que estava errado? (opcional)</label>' +
        '<textarea id="fixComentario" class="fix-comentario" rows="2" maxlength="1000" placeholder="Ex.: no refrão é &quot;pastor&quot;, não &quot;pastel&quot;"></textarea>' +
        '<label class="field-label" for="fixNome">Seu nome (opcional)</label>' +
        '<input id="fixNome" class="fix-nome" maxlength="60" autocomplete="nickname">' +
        // Campo invisível: gente não preenche, robô de spam preenche.
        '<input class="fix-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
        '<div class="fix-actions">' +
          '<span class="fix-status" role="status"></span>' +
          '<button type="submit" class="fix-send">Enviar sugestão</button>' +
        '</div>' +
      '</form>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    modal.querySelector('.fix-close').addEventListener('click', close);
    modal.querySelector('form').addEventListener('submit', send);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) { e.stopImmediatePropagation(); close(); }
    }, true);
  }

  function status(msg, kind) {
    var el = modal.querySelector('.fix-status');
    el.textContent = msg;
    el.className = 'fix-status' + (kind ? ' ' + kind : '');
  }

  function open(s) {
    if (!s) return;
    if (!modal) build();
    song = s;
    modal.querySelector('.fix-song').textContent = s.nome || 'Sem título';
    modal.querySelector('.fix-letra').value = s.letra || '';
    modal.querySelector('.fix-comentario').value = '';
    modal.querySelector('.fix-hp').value = '';
    modal.querySelector('.fix-send').disabled = false;
    status('');
    modal.hidden = false;
    var ta = modal.querySelector('.fix-letra');
    ta.focus();
    ta.setSelectionRange(0, 0);
    ta.scrollTop = 0;
  }

  function close() {
    if (modal) modal.hidden = true;
  }

  function send(e) {
    e.preventDefault();
    var c = cfg();
    var letra = modal.querySelector('.fix-letra').value;
    var comentario = modal.querySelector('.fix-comentario').value.trim();
    var nome = modal.querySelector('.fix-nome').value.trim();

    if (modal.querySelector('.fix-hp').value) { status('Sugestão enviada. Valeu!', 'ok'); return; }
    if (!c) { status('Envio indisponível no momento.', 'err'); return; }
    if (!letra.trim()) { status('A letra não pode ficar vazia.', 'err'); return; }
    if (letra === (song.letra || '') && !comentario) {
      status('Nada mudou. Edite a letra ou conte o que está errado.', 'err');
      return;
    }
    var last = 0;
    try { last = Number(localStorage.getItem(COOLDOWN_KEY)) || 0; } catch (err) {}
    if (Date.now() - last < COOLDOWN_MS) { status('Espere um minutinho antes de mandar outra.', 'err'); return; }

    var btn = modal.querySelector('.fix-send');
    btn.disabled = true;
    status('Enviando…');
    fetch(c.url + '/rest/v1/correcoes', {
      method: 'POST',
      headers: Object.assign(headers(c), { Prefer: 'return=minimal' }),
      body: JSON.stringify({
        song_id: song.id,
        song_nome: song.nome || 'Sem título',
        letra_original: song.letra || '',
        letra: letra,
        comentario: comentario || null,
        autor: nome || null
      })
    }).then(function (res) {
      if (!res.ok) throw new Error(res.status);
      try { localStorage.setItem(COOLDOWN_KEY, String(Date.now())); } catch (err) {}
      status('Sugestão enviada. Valeu!', 'ok');
      setTimeout(close, 1600);
    }).catch(function () {
      btn.disabled = false;
      status('Não deu para enviar agora. Tente de novo daqui a pouco.', 'err');
    });
  }

  ping();
  global.LyricFix = { open: open, available: function () { return !!cfg(); } };
})(window);
