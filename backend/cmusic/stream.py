"""GET /api/stream/{video_id} — resolução de áudio via yt-dlp."""
import os

from fastapi import APIRouter, HTTPException
import yt_dlp

router = APIRouter(prefix="/api")

# cookies opcionais (cookies.txt no repo, ou env YTMUSIC_COOKIES) p/ vídeos restritos
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def cookies_file():
    return os.environ.get("YTMUSIC_COOKIES") or os.path.join(ROOT, "cookies.txt")


def resolve(video_id: str):
    """Resolve o melhor stream de áudio para o vídeo."""
    opts = {
        "format": "bestaudio[ext=m4a]/bestaudio/best",
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "default_search": "ytsearch",
        "skip_download": True,
    }
    cf = cookies_file()
    if os.path.isfile(cf):
        opts["cookiefile"] = cf
    url = f"https://www.youtube.com/watch?v={video_id}"
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as e:
        msg = str(e)
        low = msg.lower()
        if "confirm your age" in low or "inappropriate for some users" in low:
            raise HTTPException(
                403,
                "Vídeo com restrição de idade — toque outra faixa ou use cookies.txt",
            )
        if "sign in to confirm" in low and "not a bot" in low:
            raise HTTPException(
                403,
                "YouTube pediu verificação — exporte cookies.txt e reinicie",
            )
        raise HTTPException(502, f"yt-dlp falhou: {msg}")
    if info is None:
        raise HTTPException(404, "Não foi possível resolver o vídeo")
    if "entries" in info:  # veio de um ytsearch
        info = next((e for e in info["entries"] if e), None)
        if not info:
            raise HTTPException(404, "Não foi possível resolver o vídeo")
    return {
        "url": info["url"],
        "title": info.get("title", "Desconhecido"),
        "artist": info.get("uploader", "Desconhecido"),
        "duration": info.get("duration") or 0,
        "ext": info.get("ext", ""),
    }


@router.get("/stream/{video_id}")
def stream(video_id: str):
    if not video_id.strip():
        raise HTTPException(400, "video_id vazio")
    return resolve(video_id)
