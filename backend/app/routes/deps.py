from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import get_db
from app.services import AdminService, AuthService, BookService, InteractionService, UserService


def get_auth_service(db: AsyncSession = Depends(get_db)) -> AuthService:
    return AuthService(db)


def get_user_service(db: AsyncSession = Depends(get_db)) -> UserService:
    return UserService(db)


def get_book_service(db: AsyncSession = Depends(get_db)) -> BookService:
    return BookService(db)


def get_interaction_service(db: AsyncSession = Depends(get_db)) -> InteractionService:
    return InteractionService(db)


def get_admin_service(db: AsyncSession = Depends(get_db)) -> AdminService:
    return AdminService(db)
