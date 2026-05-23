import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const watcherOptions = {
  ignored: ['**/node_modules/**', '**/out/**', '**/dist/**'],
  usePolling: false
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    watch: watcherOptions
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    watch: watcherOptions
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    server: {
      watch: watcherOptions
    }
  }
})
