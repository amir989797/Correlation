
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
    // EXTREME MEMORY OPTIMIZATIONS FOR 1GB RAM SERVER
    minify: false,              // Disables code minification (High RAM usage)
    cssMinify: false,           // Disables CSS minification
    sourcemap: false,           // Disables source maps
    reportCompressedSize: false,// Disables GZIP size calculation (Critically reduces RAM usage)
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: undefined // Let Rollup handle chunking naturally
      }
    }
  }
})
