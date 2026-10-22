"""Mapeamento comum de tracks (YTMusic dicts -> JSON estável)."""
from .client import ytm


def thumb_of(thumbs, fallback=""):
    if not thumbs:
        return fallback or ""
    try:
        return max(thumbs, key=lambda t: t.get("width", 0))["url"]
    except Exception:
        return thumbs[-1].get("url", fallback)


def artists_of(r):
    arts = r.get("artists")
    if isinstance(arts, list):
        return ", ".join(a["name"] for a in arts if a.get("name"))
    if isinstance(arts, dict):
        return arts.get("name", "Desconhecido")
    if isinstance(arts, str):
        return arts
    return "Desconhecido"


def dur_of(r):
    d = r.get("duration") or r.get("durationSeconds") or r.get("lengthSeconds")
    if isinstance(d, (int, float)) and d:
        return f"{int(d) // 60}:{int(d) % 60:02d}"
    return d or ""


def _thumb_fallback(video_id):
    """Capa determinística quando o YT não manda thumbnails.
    hqdefault.jpg existe para todo videoId válido (sqdefault não)."""
    return f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg" if video_id else ""


def track_of(r):
    """Mapa comum p/ tracks vindas de watch playlist, playlists e álbuns."""
    vid = r.get("videoId")
    if not vid:
        return None
    return {
        "videoId": vid,
        "title": r.get("title", "Desconhecido"),
        "artist": artists_of(r),
        "duration": dur_of(r),
        "album": (r.get("album") or {}).get("name", "") if isinstance(r.get("album"), dict) else (r.get("album") or ""),
        "thumbnail": thumb_of(r.get("thumbnails")) or _thumb_fallback(vid),
    }


def tracks_of(rows, limit=None):
    out = []
    for r in rows or []:
        t = track_of(r)
        if t:
            out.append(t)
        if limit and len(out) >= limit:
            break
    return out


def collection_meta(r, ctype, _id):
    """Metadados de coleção (card de álbum/playlist)."""
    return {
        "type": ctype,
        "id": _id,
        "title": r.get("title", "Coleção"),
        "artist": artists_of(r) if ctype == "album" else r.get("artist", ""),
        "year": r.get("year", "") or "",
        "thumbnail": thumb_of(r.get("thumbnails")),
    }
