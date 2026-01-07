
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
  build: {
    chunkSizeWarningLimit: 1500, // Increased limit to reduce warnings
    rollupOptions: {
      output: {
        // Removed manualChunks to let Vite/Rollup handle chunking automatically.
        // This prevents infinite loops and high memory usage during build.
      }
    }
  }
})
