import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { host: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three') || id.includes('@react-three')) return 'three'
            if (id.includes('react') || id.includes('scheduler')) return 'react-vendor'
            return 'vendor'
          }
        },
      },
    },
    chunkSizeWarningLimit: 1500,
  },
})
