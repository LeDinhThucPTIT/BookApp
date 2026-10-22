from alembic import context
from sqlalchemy import create_engine, pool

from app.config import settings
from app.models import Base


def run_migrations():
    # A sync migration connection is independent of the API's async event loop.
    engine = create_engine(settings.database_url.replace("mysql+aiomysql:", "mysql+pymysql:", 1), poolclass=pool.NullPool)
    try:
        with engine.connect() as connection:
            context.configure(connection=connection, target_metadata=Base.metadata, compare_type=True)
            with context.begin_transaction():
                context.run_migrations()
    finally:
        engine.dispose()


run_migrations()
