import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

// Tide runs inside Tauri. Two windows, two entry points: the main ocean and the
// small always-on-top capture bar summoned by the global hotkey.
export default defineConfig({
  // relative asset paths, so the same build runs from a file:// webview inside
  // Tauri and from a project subpath on GitHub Pages
  base: './',
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  build: {
    target: 'safari15',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        quickAdd: resolve(__dirname, 'quick-add.html'),
      },
    },
  },
})
