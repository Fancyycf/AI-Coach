import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      // 沙箱环境下 fs 事件监听不可靠，用轮询保证改文件后热更新生效
      usePolling: true,
    },
  },
})
