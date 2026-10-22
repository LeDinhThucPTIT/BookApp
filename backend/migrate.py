"""Apply versioned, additive migrations. Existing application data is preserved."""
from pathlib import Path
from alembic import command
from alembic.config import Config


def main():
    command.upgrade(Config(str(Path(__file__).with_name("alembic.ini"))), "head")
    print("Database migrations completed.")


if __name__ == "__main__":
    main()
