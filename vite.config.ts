import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Rolldown-vite usa su propio minificador integrado en Rust (más rápido)
    // No especificamos minify para usar el default de rolldown
    
    // Enable code splitting
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Separate vendor chunks for better caching
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            if (id.includes('firebase')) {
              return 'firebase-vendor';
            }
          }
        },
      },
    },
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
    // Disable source maps for smaller builds
    sourcemap: false,
  },
})
