import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: 'dist-oci',
    emptyOutDir: true,
    rollupOptions: { input: fileURLToPath(new URL('./oci.html', import.meta.url)) },
  },
})
