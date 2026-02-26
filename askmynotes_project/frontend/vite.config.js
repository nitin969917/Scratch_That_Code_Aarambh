import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/static/',
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8001',
      '/subject': 'http://127.0.0.1:8001',
      '/media': 'http://127.0.0.1:8001',
    }
  }
})
