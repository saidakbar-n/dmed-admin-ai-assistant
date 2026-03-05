import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { writeFileSync, existsSync } from 'fs'

// Auto-create index.html at build time if it doesn't exist
const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DMED Admin AI</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`

if (!existsSync('index.html')) {
  writeFileSync('index.html', html)
}

export default defineConfig({
  plugins: [react()],
})