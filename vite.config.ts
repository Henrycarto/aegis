import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { analyzeRequest } from './src/lib/model-call';

/**
 * In development, serve /api/analyze-email from the same handler Vercel runs
 * in production, with GEMINI_API_KEY read from .env on the server side only.
 * Vite exposes nothing without a VITE_ prefix to the browser.
 */
function devApi(mode: string): Plugin {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    name: 'aegis-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/analyze-email', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Allow', 'POST');
          return res.end(JSON.stringify({ error: 'Method not allowed' }));
        }
        let raw = '';
        req.on('data', chunk => { raw += chunk; });
        req.on('end', async () => {
          const { status, body } = await analyzeRequest(raw, env);
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        });
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), devApi(mode)],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
}));
