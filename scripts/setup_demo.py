"""Generate local Docker secrets without overwriting existing configuration."""
from pathlib import Path
import secrets

destination = Path(__file__).resolve().parents[1] / '.env'
try:
    with destination.open('x', encoding='utf-8') as file:
        file.write('# Local Docker demo. Never commit this file.\n')
        for name in ['MYSQL_PASSWORD', 'MYSQL_ROOT_PASSWORD', 'JWT_SECRET_KEY']:
            file.write(f'{name}={secrets.token_hex(32)}\n')
        file.write('APP_ENV=development\nCORS_ORIGINS=http://localhost:8080,http://127.0.0.1:8080\n')
    print('Created .env with random secrets. Run: docker compose up --build -d')
except FileExistsError:
    print('.env already exists; kept unchanged.')
