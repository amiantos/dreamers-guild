import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

const isDemo = process.env.VITE_DEMO_MODE === 'true'
const base = process.env.VITE_BASE_PATH || '/'

export default defineConfig({
  plugins: [vue()],
  base: base,
  resolve: {
    alias: {
      '@api': path.resolve(__dirname, isDemo ? 'src/api/demo/index.js' : 'src/api/client.js')
    }
  },
  define: {
    __DEMO_MODE__: isDemo
  },
  server: {
    port: 5178,
    proxy: isDemo ? {} : {
      '/api': {
        target: 'http://localhost:8005',
        changeOrigin: true
      }
    }
  }
})
