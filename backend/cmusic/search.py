"""GET /api/search — músicas (fallback yt-dlp) e álbuns via ytmusicapi."""
import sys

import yt_dlp
from fastapi import APIRouter

from .client import ytm
from .tracks import artists_of, track_of, thumb_of, upscale_thumb

router = APIRouter(prefix="/api")


def _song_search(q: str, limit: int = 20):
    return [t for t in (track_of(r) for r in ytm.search(q, filter="songs", limit=limit) or []) if t]


def _album_search(q: str, limit: int = 10):
    out = []
    for r in ytm.search(q, filter="albums", limit=limit) or []:
        aid = r.get("albumId") or r.get("browseId")
        if not aid:
            continue
        out.append({
            "id": aid,
            "title": r.get("title", "Desconhecido"),
            "artist": artists_of(r),
            "year": r.get("year", ""),
            "type": "album",
            "thumbnail": thumb_of(r.get("thumbnails")),
        })
    return out


def _song_search_fallback(q: str, limit: int = 20):
    """Fallback via yt-dlp caso a ytmusicapi falhe."""
    with yt_dlp.YoutubeDL(
        {"quiet": True, "no_warnings": True, "extract_flat": True, "noplaylist": True}
    ) as ydl:
        info = ydl.extract_info(f"ytsearch{limit}:{q}", download=False)
    out = []
    for e in info.get("entries") or []:
        if not e:
            continue
        dur = e.get("duration")
        out.append({
            "videoId": (e.get("id") or "").split("?")[0],
            "title": e.get("title", "Desconhecido"),
            "artist": e.get("uploader", "Desconhecido"),
            "duration": f"{int(dur) // 60}:{int(dur) % 60:02d}" if dur else "",
            "album": "",
            "thumbnail": upscale_thumb((e.get("thumbnails") or [{}])[-1].get("url", "")),
        })
    return [t for t in out if t["videoId"]]


def _playlist_search(q: str, limit: int = 10):
    """Playlists (user/community) do catálogo YT Music."""
    out = []
    for r in ytm.search(q, filter="playlists", limit=limit) or []:
        pid = r.get("playlistId") or r.get("browseId") or ""
        if not pid:
            continue
        out.append({
            "id": pid,
            "title": r.get("title", "Desconhecido"),
            "artist": artists_of(r),
            "year": r.get("year", ""),
            "type": "playlist",
            "thumbnail": thumb_of(r.get("thumbnails")),
        })
    return out


@router.get("/search")
def search(
    q: str,
    songs_lim: int = 20,
    albums_lim: int = 10,
    playlists_lim: int = 10,
):
    """Busca músicas + álbuns + playlists; cai para yt-dlp quando a API falha."""
    if not q.strip():
        return {"songs": [], "albums": [], "playlists": []}
    try:
        songs = _song_search(q, min(songs_lim, 50))
        try:
            albums = _album_search(q, min(albums_lim, 25))
        except Exception as e:
            print(f"[search] álbum search falhou ({e})", file=sys.stderr)
            albums = []
        try:
            playlists = _playlist_search(q, min(playlists_lim, 25))
        except Exception as e:
            print(f"[search] playlist search falhou ({e})", file=sys.stderr)
            playlists = []
        if not songs:
            songs = _song_search_fallback(q)
        return {"songs": songs, "albums": albums, "playlists": playlists}
    except Exception as e:
        print(f"[search] ytmusicapi falhou ({e}); usando yt-dlp", file=sys.stderr)
        return {"songs": _song_search_fallback(q), "albums": [], "playlists": []}
