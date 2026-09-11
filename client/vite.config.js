import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The dev proxy means the browser only ever talks to one origin, so no CORS
// preflight in development and the JWT header travels on a same-origin request.
// In production the API is expected behind /api on the same host.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // Bind all interfaces + allow the sandbox preview host so the app is
    // reachable through the proxied preview URL in hosted dev environments.
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
  build: { outDir: 'dist', sourcemap: true },
});
