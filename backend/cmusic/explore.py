"""GET /api/explore/home e /api/related/{video_id} — exploração e similares."""
import sys

from fastapi import APIRouter

from .client import ytm
from .tracks import thumb_of, track_of, tracks_of

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
