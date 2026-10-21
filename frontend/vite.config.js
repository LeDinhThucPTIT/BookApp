import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const backend = 'http://127.0.0.1:5000'

const proxy = {
  '/api': { target: backend, changeOrigin: true },
  '/static': { target: backend, changeOrigin: true },
  '/health': { target: backend, changeOrigin: true },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy,
  },
  preview: {
    port: 4173,
    proxy,
  },
})
