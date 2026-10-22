"""Repeatable in-process API measurements; generated rows are rolled back."""
import asyncio
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import platform
import statistics
import time

import httpx
from sqlalchemy import func, select

from app.models import Book, SessionLocal, engine, get_db
from main import create_app


async def main():
    try:
        async with SessionLocal() as db:
            try:
                db.add_all([Book(title=f'Benchmark catalog book {i:04d}', author='Benchmark Author') for i in range(1000)])
                await db.flush()
                total = await db.scalar(select(func.count(Book.id)))
                app = create_app()
                async def test_db():
                    yield db
                app.dependency_overrides[get_db] = test_db
                measurements = {}
                async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://benchmark') as client:
                    for sort in ['newest', 'favorites', 'rating']:
                        durations = []
                        for iteration in range(16):
                            started = time.perf_counter()
                            response = await client.get('/api/v1/books/catalog', params={'page_size': 12, 'sort': sort, 'search': 'Benchmark'})
                            elapsed = (time.perf_counter() - started) * 1000
                            response.raise_for_status()
                            assert response.json()['data']['total'] == 1000
                            if iteration:
                                durations.append(elapsed)
                        measurements[sort] = {'samples': len(durations), 'p50_ms': round(statistics.median(durations), 2),
                            'p95_ms': round(sorted(durations)[math.ceil(len(durations) * .95) - 1], 2)}
                report = {'measured_at_utc': datetime.now(timezone.utc).isoformat(), 'python': platform.python_version(),
                    'os': platform.system(), 'catalog_rows': total, 'generated_rows': 1000, 'page_size': 12,
                    'method': 'Sequential HTTPX ASGI requests with real local MySQL, one warmup per query; no network, TLS or concurrent load.',
                    'results': measurements}
                destination = Path(__file__).resolve().parents[1] / 'docs' / 'benchmark-local.json'
                destination.parent.mkdir(exist_ok=True)
                destination.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
                print(json.dumps(report, indent=2))
            finally:
                await db.rollback()
    finally:
        await engine.dispose()


if __name__ == '__main__':
    asyncio.run(main())
