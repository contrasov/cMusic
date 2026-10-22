"""cMusic — entrypoint do backend. A app vive no package backend/cmusic."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from cmusic import create_app
from cmusic.config import PORT

app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")
