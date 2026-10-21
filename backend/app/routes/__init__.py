from fastapi import FastAPI

from app.routes import admin, ai, auth, books, compat, interactions, users, reading_tools, tts


def register_routes(app: FastAPI) -> None:
    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(users.router, prefix="/api/v1")
    app.include_router(books.router, prefix="/api/v1")
    app.include_router(interactions.router, prefix="/api/v1")
    app.include_router(admin.router, prefix="/api/v1")
    app.include_router(ai.router, prefix="/api/v1")
    app.include_router(reading_tools.router, prefix="/api/v1")
    app.include_router(tts.router, prefix="/api/v1")
    app.include_router(compat.router)
