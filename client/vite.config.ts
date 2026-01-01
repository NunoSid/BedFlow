import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174, // Porta diferente do anterior
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:1893', // Backend NestJS
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      }
    }
  }
})
