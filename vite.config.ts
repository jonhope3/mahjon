import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Base path for GitHub Pages deployment
  // Set to '/mahjon/' for GitHub Pages, or '/' for local dev
  base: process.env.GITHUB_PAGES ? '/mahjon/' : '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
