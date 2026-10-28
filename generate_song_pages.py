from __future__ import annotations

import html
import json
import os
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SONGS_PATH = ROOT / "songs.js"
MUSICAS_DIR = ROOT / "musicas"
INDEX_PATH = ROOT / "index.html"
SITEMAP_PATH = ROOT / "sitemap.xml"
# As páginas são geradas a cada deploy; o commit no ?v= faz o navegador
# buscar o CSS/JS novo em vez de usar o que ficou em cache.
ASSET_VERSION = (os.environ.get("GITHUB_SHA") or "dev")[:7]


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_value).strip("-").lower()
    return slug or "musica"


def read_songs() -> list[dict]:
    text = SONGS_PATH.read_text(encoding="utf-8")
    if "window.SONGS" in text:
        text = text.split("window.SONGS", 1)[1]
        if "=" in text:
            text = text.split("=", 1)[1]
        if text.strip().startswith("["):
            pass
        else:
            text = text.strip()
    cleaned = text.strip().rstrip(";")
    return json.loads(cleaned)


def render_page(song: dict, prev_song: dict | None, next_song: dict | None) -> str:
    title = song.get("nome") or "Sem título"
    description = song.get("descricao") or "Letra e contexto da música do Arquivo Misa & Maria."
    lyrics = song.get("letra") or ""
    source_url = song.get("videoFonte") or ""
    audio_url = song.get("audio") or ""
    song_id = song.get("id")
    slug = slugify(title)

    meta_title = html.escape(title, quote=True)
    description_text = html.escape(description, quote=True)
    safe_lyrics = html.escape(lyrics)
    # audio/banner/etc em songs.js são relativos à raiz do site (pra servir a
    # home); daqui de dentro de musicas/ precisam subir um nível.
    audio_url_abs = f"https://misaemaria.github.io/{audio_url}" if audio_url else ""
    safe_audio = html.escape(f"../{audio_url}" if audio_url else "", quote=True)
    safe_source = html.escape(source_url, quote=True)
    safe_url = f"https://misaemaria.github.io/musicas/{slug}.html"

    audio_html = (
        f'<audio controls controlsList="nodownload noplaybackrate" preload="none" src="{safe_audio}"></audio>'
        if audio_url
        else '<p class="no-audio">Ainda sem áudio enviado para esta música.</p>'
    )

    source_html = (
        f'<div class="field-label">Origem</div>'
        f'<a class="srclink" href="{safe_source}" target="_blank" rel="noopener">▶ Ver o vídeo que gerou essa música</a>'
        if source_url
        else ""
    )

    schema = {
        "@context": "https://schema.org",
        "@type": "MusicRecording",
        "name": title,
        "url": safe_url,
        "description": description,
        "byArtist": {"@type": "MusicGroup", "name": "Misa & Maria"},
    }
    if audio_url:
        schema["audio"] = {"@type": "AudioObject", "contentUrl": audio_url_abs}
    if source_url:
        schema["isPartOf"] = {"@type": "CreativeWork", "url": source_url}

    schema_json = json.dumps(schema, ensure_ascii=False)

    nav_links = ""
    if prev_song:
        prev_slug = slugify(prev_song.get("nome") or "Sem título")
        nav_links += f'<a class="prev" href="{prev_slug}.html">← {html.escape(prev_song.get("nome") or "Sem título")}</a>'
    if next_song:
        next_slug = slugify(next_song.get("nome") or "Sem título")
        nav_links += f'<a class="next" href="{next_slug}.html">{html.escape(next_song.get("nome") or "Sem título")} →</a>'
    song_nav_html = f'<nav class="song-nav">{nav_links}</nav>' if nav_links else ""

    return f'''<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index,follow">
  <meta name="description" content="{description_text}">
  <meta property="og:title" content="{meta_title} | Arquivo Misa & Maria">
  <meta property="og:description" content="{description_text}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="{safe_url}">
  <link rel="canonical" href="{safe_url}">
  <script type="application/ld+json">{schema_json}</script>
  <title>{meta_title} | Arquivo Misa & Maria</title>
  <link rel="icon" href="../favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="32x32" href="../assets/icons/favicon-32.png">
  <link rel="icon" type="image/png" sizes="192x192" href="../assets/icons/icon-192.png">
  <link rel="apple-touch-icon" href="../assets/icons/apple-touch-icon.png">
  <meta name="theme-color" content="#1a1250">
  <link rel="stylesheet" href="../style.css?v={ASSET_VERSION}">
</head>
<body>
  <header class="top">
    <img class="banner" src="../assets/banner.jpg" alt="Misa & Maria">
  </header>

  <main class="wrap">
    <nav class="breadcrumb">
      <a href="../index.html">← Retornar</a>
    </nav>

    <article class="song-page">
      <div class="song-title-row">
        <h1>{meta_title}</h1>
        <button type="button" class="fav-btn song-fav" id="songFavBtn" aria-label="Adicionar aos favoritos">♡</button>
      </div>

      <div class="field-label">Tocar</div>
      {audio_html}

      <div class="field-label">Sobre</div>
      <p>{html.escape(description, quote=True)}</p>

      {source_html}

      <div class="field-label">Letra</div>
      <div class="lyrics" id="songLyrics">{safe_lyrics}</div>
      <button type="button" class="fix-open" id="fixOpenBtn" hidden>✎ Achou algo errado na letra? Sugerir correção</button>

      {song_nav_html}
    </article>
  </main>

  <script src="../favorites.js?v=1"></script>
  <script src="../views.js?v=1"></script>
  <script src="../supabase-config.js?v={ASSET_VERSION}"></script>
  <script src="../corrections.js?v={ASSET_VERSION}"></script>
  <script>
    if (window.Views) window.Views.hit({json.dumps(slug)});
  </script>
  <script>
    (function () {{
      var btn = document.getElementById('fixOpenBtn');
      if (!btn || !window.LyricFix || !window.LyricFix.available()) return;
      btn.hidden = false;
      btn.addEventListener('click', function () {{
        window.LyricFix.open({{
          id: {json.dumps(song_id)},
          nome: {json.dumps(title, ensure_ascii=False)},
          letra: document.getElementById('songLyrics').textContent
        }});
      }});
    }})();
  </script>
  <script>
    (function () {{
      var id = {json.dumps(song_id)};
      var btn = document.getElementById('songFavBtn');
      if (!btn || !window.Favorites || id == null) return;
      function paint(fav) {{
        btn.classList.toggle('active', fav);
        btn.textContent = fav ? '♥' : '♡';
        btn.setAttribute('aria-label', fav ? 'Remover dos favoritos' : 'Adicionar aos favoritos');
      }}
      paint(window.Favorites.isFavorite(id));
      btn.addEventListener('click', function () {{ paint(window.Favorites.toggleFavorite(id)); }});
    }})();
  </script>
</body>
</html>
'''


def write_song_pages(songs: list[dict]) -> list[str]:
    MUSICAS_DIR.mkdir(exist_ok=True)
    generated = []

    # Mesma ordem da home (main.js): id decrescente, mais recente primeiro.
    ordered = sorted(songs, key=lambda s: s.get("id") or 0, reverse=True)

    for i, song in enumerate(ordered):
        title = song.get("nome") or "Sem título"
        slug = slugify(title)
        prev_song = ordered[i - 1] if i > 0 else None
        next_song = ordered[i + 1] if i + 1 < len(ordered) else None
        page_path = MUSICAS_DIR / f"{slug}.html"
        page_path.write_text(render_page(song, prev_song, next_song), encoding="utf-8")
        generated.append(f"https://misaemaria.github.io/musicas/{slug}.html")

    return generated


def render_home_section(songs: list[dict]) -> str:
    items = []
    for song in songs:
        title = song.get("nome") or "Sem título"
        description = song.get("descricao") or "Música do Arquivo Misa & Maria."
        slug = slugify(title)
        items.append(
            f'''        <li>
          <article>
            <h3><a href="musicas/{slug}.html">{html.escape(title)}</a></h3>
            <p>{html.escape(description)}</p>
          </article>
        </li>'''
        )

    return f'''    <section class="seo-index" aria-label="Músicas em destaque">
      <h2>Músicas em destaque</h2>
      <ul>
{chr(10).join(items)}
      </ul>
    </section>'''


def render_item_list_json(songs: list[dict]) -> str:
    entries = []
    for idx, song in enumerate(songs, start=1):
        title = song.get("nome") or "Sem título"
        slug = slugify(title)
        entries.append(
            '{ "@type": "ListItem", "position": ' + str(idx) + ', "name": ' + json.dumps(title, ensure_ascii=False) + ', "url": "https://misaemaria.github.io/musicas/' + slug + '.html" }'
        )

    entries_text = ', '.join(entries)
    return (
        '  <script type="application/ld+json">\n'
        '  {\n'
        '    "@context": "https://schema.org",\n'
        '    "@type": "ItemList",\n'
        '    "name": "Músicas do Arquivo Misa & Maria",\n'
        '    "itemListElement": [\n'
        f'      {entries_text}\n'
        '    ]\n'
        '  }\n'
        '  </script>'
    )


def update_index_file(songs: list[dict]) -> None:
    text = INDEX_PATH.read_text(encoding="utf-8")
    old_section = '''    <section class="seo-index" aria-label="Músicas em destaque">
      <h2>Músicas em destaque</h2>
      <ul>
        <li>
          <article>
            <h3><a href="musicas/maquiavelico-plano-de-conquista.html">Maquiavélico Plano de Conquista</a></h3>
            <p>Treta entre a Espectro Cinza e o Renan Santos, com uma estrutura de rap que mistura humor, referência cultural e momento icônico da live.</p>
          </article>
        </li>
        <li>
          <article>
            <h3><a href="musicas/valeria-valquiria-selene-dragao.html">Valéria, Valquíria, Selene dragão</a></h3>
            <p>Música inspirada no debate mais caótico e memorável do Pergunte ao ateu, com letras agressivas, engraçadas e muito marcantes para o público.</p>
          </article>
        </li>
      </ul>
    </section>'''

    new_section = render_home_section(songs)
    text = text.replace(old_section, new_section)

    old_schema = '''  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Músicas do Arquivo Misa & Maria",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Maquiavélico Plano de Conquista", "url": "https://misaemaria.github.io/" },
      { "@type": "ListItem", "position": 2, "name": "Valéria, Valquíria, Selene dragão", "url": "https://misaemaria.github.io/" }
    ]
  }
  </script>'''

    text = text.replace(old_schema, render_item_list_json(songs))
    INDEX_PATH.write_text(text, encoding="utf-8")


def build_sitemap(urls: list[str]) -> str:
    items = "\n".join(
        f"  <url>\n    <loc>{url}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>{'1.0' if i == 0 else '0.9'}</priority>\n  </url>"
        for i, url in enumerate(urls)
    )
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{items}
</urlset>
'''


def main() -> None:
    songs = read_songs()
    urls = ["https://misaemaria.github.io/"] + write_song_pages(songs)
    update_index_file(songs)
    SITEMAP_PATH.write_text(build_sitemap(urls), encoding="utf-8")
    print(f"Generated {len(songs)} song pages, updated homepage links, and updated sitemap.xml")


if __name__ == "__main__":
    main()
