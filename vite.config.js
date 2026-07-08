import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        // Local frontend dev proxies to the DEV API by default — never
        // production. Override when needed, e.g. against a local worker:
        //   PPGK_API_PROXY_TARGET=http://localhost:8787 npm run dev
        target: process.env.PPGK_API_PROXY_TARGET || 'https://dev.ppgk.app',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});