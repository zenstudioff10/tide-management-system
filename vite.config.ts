import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

// Tide runs inside Tauri. Two windows, two entry points: the main ocean and the
// small always-on-top capture bar summoned by the global hotkey.
export default defineConfig({
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
