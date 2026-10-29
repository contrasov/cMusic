"""GET /api/album/{coll_id} — álbum, playlist ou rádio (coleções)."""
import sys

from fastapi import APIRouter

from .client import ytm
from .tracks import track_of, artists_of, thumb_of

router = APIRouter(prefix="/api")


def _collection_payload(coll, ctype):
    return {
        "type": ctype,
        "id": coll["id"],
        "title": coll["title"],
        "artist": coll["artist"],
        "year": coll["year"],
        "thumbnail": coll["thumbnail"],
        "tracks": coll["tracks"],
    }


@router.get("/album/{coll_id}")
def album(coll_id: str):
    """Álbuns (MPREb/VL), playlists (PL/RDCLAK) e rádios."""
    if (coll_id.startswith("MPREb") or coll_id.startswith("VL")
            or coll_id.startswith("OLAK5uy")):
        a = ytm.get_album(coll_id.removeprefix("VL"))
        tracks = [t for t in (track_of(x) for x in a.get("tracks", []) or []) if t]
        return _collection_payload(
            {
                "id": coll_id,
                "title": a.get("title", "Álbum"),
                "artist": artists_of(a),
                "year": a.get("year", ""),
                "thumbnail": thumb_of(a.get("thumbnails")),
                "tracks": tracks,
            },
            "album",
        )

    # playlists / rádios (PL..., RDCLAK...)
    try:
        pl = ytm.get_playlist(coll_id, limit=50) or {}
        tracks = [t for t in (track_of(x) for x in pl.get("tracks", []) or []) if t]
        return _collection_payload(
            {
                "id": coll_id,
                "title": pl.get("title", "Playlist"),
                "artist": (pl.get("description") or "YouTube Music").split("\n")[0],
                "year": "",
                "thumbnail": thumb_of(pl.get("thumbnails")),
                "tracks": tracks,
            },
            "playlist",
        )
    except Exception as e:
        print(f"[album] playlist falhou ({e})", file=sys.stderr)

    wp = ytm.get_watch_playlist(coll_id, limit=50) or {}
    meta = wp.get("playlistMetadata") or {}
    tracks = [t for t in (track_of(x) for x in wp.get("tracks", []) or []) if t]
    return _collection_payload(
        {
            "id": coll_id,
            "title": meta.get("title", "Playlist"),
            "artist": "YouTube Music",
            "year": "",
            "thumbnail": "",
            "tracks": tracks,
        },
        "playlist",
    )
