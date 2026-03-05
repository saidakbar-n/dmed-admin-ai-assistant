// admin-ai-assistant/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: '.',          // current folder
  build: {
    outDir: 'dist',   // publish folder
    emptyOutDir: true
  }
})