import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  
  // ⭐ ADD BUILD OPTIMIZATION
  build: {
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  
  // ⭐ ADD DEV SERVER OPTIMIZATION
  server: {
    headers: {
      'Cache-Control': 'max-age=0, must-revalidate',
    },
  },
})
