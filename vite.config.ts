import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        external: ['pdfjs-dist', '@google/genai']
      }
    },
    // This configuration makes the API key available in the browser-side code.
    // Vercel provides environment variables during the build process. This `define`
    // block tells Vite to replace any occurrence of `process.env.API_KEY` in the
    // source code with the actual value of the API_KEY from the build environment.
    // JSON.stringify is crucial to ensure the key is correctly embedded as a string.
    define: {
      'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
    }
  }
})
