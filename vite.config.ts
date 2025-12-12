
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Listen on 0.0.0.0
    port: 3000
  },
  preview: {
    host: true, // Listen on 0.0.0.0
    port: 3000
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          recharts: ['recharts'],
          icons: ['lucide-react']
        }
      }
    }
  }
})
