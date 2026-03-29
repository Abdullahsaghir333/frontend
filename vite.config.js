import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Allow requests from any origin (needed for Python backend)
    allowedHosts: true,
    // Force a specific port
    port: 5173,
    strictPort: false,
    proxy: {
      // Node/Mongo backend (cookies work because browser hits same origin `/api`)
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
