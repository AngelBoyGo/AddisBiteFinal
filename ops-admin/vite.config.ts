import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Addis Bites — Admin dashboard (fourth surface).
// Served from its own sub-path (/admin/) so it can sit beside the public site and
// the Operations Console on one origin. Routing is hash-based (#/overview, #/money),
// so deep links survive from any base without a server rewrite.
export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  build: { outDir: 'dist', chunkSizeWarningLimit: 1200 }
})
