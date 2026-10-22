import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  use: { baseURL: 'http://127.0.0.1:4175', trace: 'retain-on-failure', ...devices['Desktop Chrome'] },
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: [
    {
      command: process.env.BOOKAPP_BACKEND_COMMAND || '../backend/.venv/Scripts/python.exe -m uvicorn main:app --host 127.0.0.1 --port 5017 --app-dir ../backend',
      url: 'http://127.0.0.1:5017/health/ready',
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4175 --strictPort',
      url: 'http://127.0.0.1:4175',
      env: { BOOKAPP_API_TARGET: 'http://127.0.0.1:5017' },
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
})
