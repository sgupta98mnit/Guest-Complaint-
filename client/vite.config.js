import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_BASE_PATH lets the same build serve from a subpath. Unset (development,
// or a root deployment) it is "/" and nothing changes; the container build sets
// it to "/projects/asett/" so asset URLs, router links, and API calls all carry
// the prefix Caddy routes on. See client/src/basePath.js.
const base = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    // Same-origin /api in development, so client code never needs to know where
    // the API lives. In production Express serves this build from its own
    // origin, so the identical relative URLs keep working.
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
