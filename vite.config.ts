import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Addis Bites Operations Console — React SPA (front-end only, mock data).
// Builds to ./dist which `wrangler pages deploy` publishes as static assets.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200
  }
})
