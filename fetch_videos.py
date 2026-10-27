"""Gera videos.js com os vídeos mais recentes dos canais do Misa e Maria.

Lê o feed público (RSS) de cada canal do YouTube — não precisa de chave de
API. Roda no workflow do Pages (a cada hora e a cada push). Se um canal
falhar, mantém os vídeos dele que já estavam no videos.js, pra lateral nunca
ficar vazia por causa de uma falha passageira do YouTube.
"""
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

CHANNELS = [
    {"id": "UC-eAIFfuUPnB9TGRfJMZN0Q", "nome": "Misa e Maria"},
    {"id": "UCwFfstSisCRMQD_2pvsBZpw", "nome": "Cortes"},
]
POR_CANAL = 8  # o canal de cortes posta muito; sem limite ele tomaria a lateral toda
OUT = Path(__file__).with_name("videos.js")
NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "yt": "http://www.youtube.com/xml/schemas/2015",
}


def load_existing():
    if not OUT.exists():
        return []
    m = re.search(r"window\.VIDEOS\s*=\s*(\[[\s\S]*\]);?", OUT.read_text(encoding="utf-8"))
    return json.loads(m.group(1)) if m else []


def fetch_channel(channel):
    url = "https://www.youtube.com/feeds/videos.xml?channel_id=" + channel["id"]
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as res:
        root = ET.fromstring(res.read())
    videos = []
    for entry in root.findall("atom:entry", NS)[:POR_CANAL]:
        link = entry.find("atom:link", NS)
        href = link.get("href", "") if link is not None else ""
        videos.append({
            "id": entry.findtext("yt:videoId", default="", namespaces=NS),
            "titulo": entry.findtext("atom:title", default="", namespaces=NS),
            "publicado": entry.findtext("atom:published", default="", namespaces=NS),
            "canal": channel["nome"],
            "short": "/shorts/" in href,
        })
    return [v for v in videos if v["id"]]


def main():
    existing = load_existing()
    videos = []
    for channel in CHANNELS:
        try:
            videos += fetch_channel(channel)
        except Exception as e:  # noqa: BLE001 — qualquer falha de rede/XML cai no fallback
            print(f"Falha no canal {channel['nome']}: {e}; mantendo os vídeos anteriores")
            videos += [v for v in existing if v.get("canal") == channel["nome"]]
    videos.sort(key=lambda v: v["publicado"], reverse=True)
    OUT.write_text("window.VIDEOS = " + json.dumps(videos, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
    print(f"{len(videos)} vídeos gravados em {OUT.name}")


if __name__ == "__main__":
    main()
