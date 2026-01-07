
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const proxyOptions = {
  '/api': {
    target: 'http://localhost:8000',
    changeOrigin: true
  },
  '/sitemap.xml': {
    target: 'http://localhost:8000',
    changeOrigin: true
  }
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Listen on 0.0.0.0
    port: 3000,
    proxy: proxyOptions
  },
  preview: {
    host: true, // Listen on 0.0.0.0
    port: 3000,
    allowedHosts: [
        'arkarise.ir', 
        'www.arkarise.ir', 
    ],
    proxy: proxyOptions
  },
  optimizeDeps: {
    exclude: ['react-router-dom', 'react-router']
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          recharts: ['recharts'],
          icons: ['lucide-react']
        }
      }
    }
  }
})
