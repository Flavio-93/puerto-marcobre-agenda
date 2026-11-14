import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: true,
    proxy: {
      '/api/teams-webhook': {
        target: 'https://default00015d9221ad48a88445a7d68bf899.bd.environment.api.powerplatform.com:443',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/teams-webhook/, '/powerautomate/automations/direct/cu/14/workflows/299056f934e54374ad144140f75b561a/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=9hBfm9JW7oKxPpjxaNmaZEX1GzQ0DYviwFzNZ7apbFM'),
      },
    },
  },
})
