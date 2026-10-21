"""Run `python migrate.py` from backend before starting the updated application.

Creates reading tools tables, adds chapter anchors to progress and widens
chapter content for Unicode text. Safe to repeat; needs CREATE/ALTER permission.
"""
import asyncio
from sqlalchemy import inspect, text

from app.models import engine
from app.models.reading_progress import ReadingProgress
from app.models.reading_tools import Story, StoryChapter, Annotation
from app.utils.reader import paginate_text


async def main():
    try:
        async with engine.begin() as connection:
            for table in (ReadingProgress.__table__, Story.__table__, StoryChapter.__table__, Annotation.__table__):
                await connection.run_sync(table.create, checkfirst=True)
            columns = await connection.run_sync(lambda sync: {item["name"] for item in inspect(sync).get_columns("reading_progress")})
            for column in ("chapter_id", "chapter_page"):
                if column not in columns:
                    await connection.execute(text(f"ALTER TABLE reading_progress ADD COLUMN {column} INT NULL"))
            chapter_columns = await connection.run_sync(lambda sync: inspect(sync).get_columns("story_chapters"))
            if "page_count" not in {item["name"] for item in chapter_columns}:
                await connection.execute(text("ALTER TABLE story_chapters ADD COLUMN page_count INT NOT NULL DEFAULT 1"))
                rows = (await connection.execute(text("SELECT id, content FROM story_chapters"))).all()
                for chapter_id, content in rows:
                    await connection.execute(text("UPDATE story_chapters SET page_count=:count WHERE id=:id"), {"count": max(1, len(paginate_text(content))), "id": chapter_id})
            if any(item["name"] == "content" and str(item["type"]).upper() == "TEXT" for item in chapter_columns):
                await connection.execute(text("ALTER TABLE story_chapters MODIFY COLUMN content MEDIUMTEXT NOT NULL"))
            for table, additions in {
                "annotations": {"chapter_page": "INT NULL", "source_hash": "VARCHAR(64) NULL"},
                "reading_progress": {"revision": "INT NOT NULL DEFAULT 0", "mutation_id": "VARCHAR(64) NULL"},
            }.items():
                present = await connection.run_sync(lambda sync: {item["name"] for item in inspect(sync).get_columns(table)})
                for column, declaration in additions.items():
                    if column not in present:
                        await connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {declaration}"))
        print("Reading tools migration completed.")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
