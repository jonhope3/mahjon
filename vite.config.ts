import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const appVersion =
  process.env.GITHUB_SHA?.slice(0, 7) ||
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
  `${process.env.npm_package_version || '0.1.0'}-${Date.now().toString(36)}`;

export default defineConfig({
  plugins: [react()],
  // Base path for GitHub Pages deployment
  // Set to '/mahjon/' for GitHub Pages, or '/' for local dev
  base: process.env.GITHUB_PAGES ? '/mahjon/' : '/',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
