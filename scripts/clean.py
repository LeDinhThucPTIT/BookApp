"""Remove reproducible build/test output and Python bytecode inside this repository."""
import argparse
import os
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
OUTPUTS = (
    ROOT / "frontend" / "dist",
    ROOT / "frontend" / "dist-ssr",
    ROOT / "frontend" / "playwright-report",
    ROOT / "frontend" / "test-results",
)
EXCLUDED = {".venv", "node_modules", ".git", ".cache", "backups", "static"}


def candidates():
    yield from OUTPUTS
    for folder in (ROOT / "backend", ROOT / "scripts"):
        for current, directories, _ in os.walk(folder, followlinks=False):
            for name in directories[:]:
                path = Path(current) / name
                if name == "__pycache__":
                    yield path
                if name == "__pycache__" or name in EXCLUDED or path.is_symlink() or path.is_junction():
                    directories.remove(name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="List generated directories without deleting them")
    args = parser.parse_args()
    count = 0
    for path in candidates():
        if not path.exists() or path.is_symlink() or path.is_junction():
            continue
        resolved = path.resolve()
        if not resolved.is_relative_to(ROOT) or resolved == ROOT:
            raise RuntimeError(f"Refusing to clean a path outside the repository: {path}")
        if path not in OUTPUTS and path.name != "__pycache__":
            raise RuntimeError(f"Not a generated directory: {path}")
        print(f"{'Would remove' if args.dry_run else 'Removing'}: {path.relative_to(ROOT).as_posix()}")
        if not args.dry_run:
            shutil.rmtree(resolved)
        count += 1
    print(f"{count} generated directories {'found' if args.dry_run else 'removed'}.")


if __name__ == "__main__":
    main()
