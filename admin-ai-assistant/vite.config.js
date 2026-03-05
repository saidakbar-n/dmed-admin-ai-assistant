import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // No proxy needed — the app calls Gemini directly from the browser
  // using VITE_GEMINI_API_KEY injected at build time
})