
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
    // Disabling minification fixes the build hang on low-memory servers
    // especially when processing heavy libraries like lodash/recharts.
    minify: false, 
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
})
