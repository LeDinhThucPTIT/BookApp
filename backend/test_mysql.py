"""Run integration checks in a newly-created database; never import/reset the user's database."""
import os
from pathlib import Path
import subprocess
import shutil
import sys
from uuid import uuid4

import pymysql
from pymysql.constants import CLIENT

from app.config import settings


def main():
    name = 'bookapp_test_' + uuid4().hex
    root = Path(__file__).resolve().parent
    connection = pymysql.connect(host=settings.mysql_host, port=settings.mysql_port,
        user=settings.mysql_user, password=settings.mysql_password, charset='utf8mb4',
        autocommit=True, client_flag=CLIENT.MULTI_STATEMENTS)
    created = False
    try:
        with connection.cursor() as cursor:
            cursor.execute(f'CREATE DATABASE `{name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')
            created = True
            cursor.execute(f'USE `{name}`')
            cursor.execute((root / 'bookapp.sql').read_text(encoding='utf-8'))
            while cursor.nextset():
                pass
        env = os.environ | {'MYSQL_DATABASE': name, 'BOOKAPP_TEST_MYSQL': '1', 'DEBUG': 'false'}
        print(f'Isolated test database: {name}', flush=True)
        for command in [['migrate.py'], ['migrate.py'], ['-m', 'unittest', 'discover', '-s', 'tests', '-v']]:
            subprocess.run([sys.executable, *command], cwd=root, env=env, check=True)
        if '--e2e' in sys.argv or '--screenshots' in sys.argv:
            env['CORS_ORIGINS'] = 'http://127.0.0.1:4175'
            env['BOOKAPP_BACKEND_COMMAND'] = f'"{sys.executable}" -m uvicorn main:app --host 127.0.0.1 --port 5017 --app-dir ../backend'
            command = [shutil.which('npm'), 'run', 'test:e2e']
            if '--screenshots' in sys.argv:
                env['BOOKAPP_CAPTURE_SCREENSHOTS'] = '1'
                command.extend(['--', '--grep', 'portfolio screenshots'])
            subprocess.run(command, cwd=root.parent / 'frontend', env=env, check=True)
        if '--benchmark' in sys.argv:
            subprocess.run([sys.executable, 'benchmark_catalog.py'], cwd=root, env=env, check=True)
    finally:
        if created and name.startswith('bookapp_test_') and len(name) == len('bookapp_test_') + 32:
            with connection.cursor() as cursor:
                cursor.execute(f'DROP DATABASE `{name}`')
        connection.close()


if __name__ == '__main__':
    main()
