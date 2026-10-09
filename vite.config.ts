import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// BASE_PATH lets GitHub Pages serve the app from /<repo-name>/.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
})
