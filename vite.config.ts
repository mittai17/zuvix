import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
      }
    ]),
    renderer(),
  ],
  server: {
    watch: {
      ignored: ['**/agents/**', '**/target/**', '**/node_modules/**', '**/repos/**'],
    },
  },
  build: {
    rollupOptions: {
      external: ['electron'],
    },
  },
  optimizeDeps: {
    exclude: ['electron'],
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
