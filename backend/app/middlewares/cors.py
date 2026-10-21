from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings


def register_cors(app: FastAPI) -> None:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Audio-Segments"],
    )
