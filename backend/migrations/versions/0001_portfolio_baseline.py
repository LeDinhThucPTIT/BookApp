"""Adopt existing demo databases and initialize empty databases without replacing data."""
from alembic import op
from sqlalchemy import inspect, text

from app.models import Base
from app.utils.reader import paginate_text

revision = "0001_portfolio"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    Base.metadata.create_all(connection)
    additions = {
        "users": {"token_version": "INT NOT NULL DEFAULT 0"},
        "annotations": {"chapter_page": "INT NULL", "source_hash": "VARCHAR(64) NULL"},
        "reading_progress": {"chapter_id": "INT NULL", "chapter_page": "INT NULL",
                             "revision": "INT NOT NULL DEFAULT 0", "mutation_id": "VARCHAR(64) NULL"},
    }
    for table, columns in additions.items():
        present = {item["name"] for item in inspect(connection).get_columns(table)}
        for column, declaration in columns.items():
            if column not in present:
                connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {declaration}"))
    chapter_columns = inspect(connection).get_columns("story_chapters")
    if "page_count" not in {item["name"] for item in chapter_columns}:
        connection.execute(text("ALTER TABLE story_chapters ADD COLUMN page_count INT NOT NULL DEFAULT 1"))
        for chapter_id, content in connection.execute(text("SELECT id, content FROM story_chapters")).all():
            connection.execute(text("UPDATE story_chapters SET page_count=:count WHERE id=:id"),
                {"count": max(1, len(paginate_text(content))), "id": chapter_id})
    if any(item["name"] == "content" and str(item["type"]).upper() == "TEXT" for item in chapter_columns):
        connection.execute(text("ALTER TABLE story_chapters MODIFY COLUMN content MEDIUMTEXT NOT NULL"))
    for table, name, columns in [
        ("books", "ix_books_created_at", ["created_at"]),
        ("comments", "ix_comments_book_created", ["book_id", "created_at"]),
        ("saves", "ix_saves_user_created", ["user_id", "created_at"]),
    ]:
        if name not in {index["name"] for index in inspect(connection).get_indexes(table)}:
            op.create_index(name, table, columns)


def downgrade():
    # This baseline adopts pre-existing user data; dropping it would be destructive.
    raise RuntimeError("Baseline downgrade is unsupported; restore a database backup instead.")
