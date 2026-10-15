import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Addis Bites Operations Console — React SPA (front-end only, mock data).
//
// `base` matters: the console is served from its own sub-path (/console/) so it
// can sit behind the public site on one origin during preview, and later on its
// own host. Routing is hash-based (#/board, #/money) so the deep links keep
// working from any base without a server rewrite.
export default defineConfig({
  base: '/console/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200
  }
})
