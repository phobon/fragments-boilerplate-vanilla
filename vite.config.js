import { defineConfig } from 'vite'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
  build: {
    target: 'esnext',
  },
  plugins: [],
  resolve: {
    alias: {
      '@/sketches': path.resolve(__dirname, 'src/sketches'),
      '@/tsl': path.resolve(__dirname, 'src/tsl'),
    },
  },
})
