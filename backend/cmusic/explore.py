"""GET /api/explore/home, /api/explore/for-you e /api/related/{video_id}."""
import sys

from fastapi import APIRouter

from .client import ytm
from .tracks import thumb_of, track_of, tracks_of
from .search import _album_search, _song_search

router = APIRouter(prefix="/api")


@router.get("/explore/home")
def explore_home():
    """Quick picks (músicas) + coleções/álbuns recomendados."""
    home = ytm.get_home() or []
    songs, collections = [], []
    for sec in home:
        title = sec.get("title") or ""
        for c in sec.get("contents", []) or []:
            if c.get("videoId"):
                t = track_of(c)
                if t:
                    songs.append(t)
            elif c.get("playlistId"):
                pid = c["playlistId"]
                if pid in {x["id"] for x in collections}:
                    continue
                collections.append({
                    "id": pid,
                    "title": c.get("title", "Coleção"),
                    "artist": (c.get("description") or title or "").strip() or "YouTube Music",
                    "type": "album" if pid.startswith("MPREb") else "playlist",
                    "year": "",
                    "thumbnail": thumb_of(c.get("thumbnails")),
                })
    return {"songs": songs[:16], "collections": collections[:12]}


@router.get("/explore/charts")
def explore_charts(regions: str = "BR,ZZ"):
    """Playlists dos charts do YT Music (populares do momento), BR primeiro."""
    out, seen = [], set()
    for reg in [r.strip().upper() for r in regions.split(",") if r.strip()][:3]:
        try:
            ch = ytm.get_charts(country=reg) or {}
        except Exception as e:
            print(f"[charts] {reg} falhou ({e})", file=sys.stderr)
            continue
        label = "Global" if reg == "ZZ" else reg
        for v in ch.get("videos", []) or []:
            pid = v.get("playlistId")
            if not pid or pid in seen:
                continue
            seen.add(pid)
            out.append({
                "id": pid,
                "title": v.get("title", "Top"),
                "artist": label,
                "type": "playlist",
                "year": "",
                "thumbnail": thumb_of(v.get("thumbnails")),
            })
        if len(out) >= 12:
            break
    return {"collections": out[:12]}


@router.get("/explore/for-you")
def explore_for_you(artists: str = "", per_artist: int = 4):
    """Álbuns dos artistas mais ouvidos (intercalados, sem duplicar).

    artists: nomes separados por "||" (vem do localStorage do front).
    """
    names = [a.strip() for a in (artists or "").split("||") if a.strip()][:4]
    if not names:
        return {"collections": []}
    per_artist = max(2, min(per_artist, 8))
    buckets, seen = [], set()
    for name in names:
        try:
            found = _album_search(name, limit=per_artist)
        except Exception as e:
            print(f"[for-you] busca de álbuns de {name!r} falhou ({e})", file=sys.stderr)
            found = []
        bucket = []
        for c in found:
            if c["id"] in seen:
                continue
            seen.add(c["id"])
            bucket.append(c)
        if bucket:
            buckets.append(bucket)
    # intercala: 1º de cada artista, depois 2º de cada, ...
    out = []
    for i in range(per_artist):
        for b in buckets:
            if i < len(b):
                out.append(b[i])
    return {"collections": out[:12]}


@router.get("/explore/for-you-songs")
def explore_for_you_songs(artists: str = "", limit: int = 16):
    """Músicas dos artistas mais ouvidos do usuário (intercaladas).

    artists: nomes separados por "||" (vem do localStorage do front).
    """
    names = [a.strip() for a in (artists or "").split("||") if a.strip()][:3]
    if not names:
        return {"songs": []}
    per_artist = max(3, min(limit // len(names), 12))
    buckets, seen = [], set()
    for name in names:
        try:
            found = _song_search(name, limit=per_artist + 2)
        except Exception as e:
            print(f"[for-you-songs] busca de {name!r} falhou ({e})", file=sys.stderr)
            found = []
        bucket = []
        for s in found:
            if s["videoId"] in seen:
                continue
            seen.add(s["videoId"])
            bucket.append(s)
        if bucket:
            buckets.append(bucket)
    out = []
    for i in range(per_artist):
        for b in buckets:
            if i < len(b):
                out.append(b[i])
    return {"songs": out[:limit]}


@router.get("/related/{video_id}")
def related(video_id: str, limit: int = 20):
    """Rádio/similares de um vídeo (get_watch_playlist)."""
    limit = max(10, min(limit, 100))
    try:
        wp = ytm.get_watch_playlist(video_id, limit=limit + 5) or {}
    except Exception as e:
        print(f"[related] watch playlist falhou ({e})", file=sys.stderr)
        return []
    return tracks_of(wp.get("tracks"), limit=limit)
