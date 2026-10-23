"""cMusic — backend FastAPI + ytmusicapi + yt-dlp.

Anônimo: busca, home (quick picks), similares, coleções/álbuns.
Frontend estático servido de /src.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import collection, explore, search, stream
from .config import FRONTEND_DIR


def create_app() -> FastAPI:
    app = FastAPI(title="cMusic API")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(search.router)
    app.include_router(stream.router)
    app.include_router(explore.router)
    app.include_router(collection.router)

    @app.middleware("http")
    async def cache_control(_req, call_next):
        """Força revalidação (no-cache + ETag): nunca serve JS/CSS antigo após update."""
        resp = await call_next(_req)
        resp.headers["Cache-Control"] = "no-cache"
        return resp

    @app.get("/api/health")
    def health():
        return {"status": "ok", "app": "cMusic"}

    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")
    return app
