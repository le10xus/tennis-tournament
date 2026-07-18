import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => {
  return {
    base: command === 'build' ? '/static/frontend/' : '/',
    plugins: [react()],
    server: {
      port: 5174,
      strictPort: true,
      proxy: {
        '/api': 'http://localhost:8000',
      },
    },
  }
})
