"""Configuração central do cMusic backend."""
import os

PORT = int(os.environ.get("YTMUSIC_PORT", "8377"))
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "src"))
