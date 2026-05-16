import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api':    'http://localhost:8765',
      '/events': 'http://localhost:8765',
      '/health': 'http://localhost:8765',
      '/ws': { target: 'ws://localhost:8765', ws: true, changeOrigin: true },
    },
  },
})
