import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Parse .env.local directly so that system-level environment variables
 * (which may be empty) don't shadow the values defined in the file.
 * Vite's loadEnv merges process.env on top, so an empty system var wins.
 */
function readDotEnvLocal(): Record<string, string> {
  const filePath = path.resolve(__dirname, '.env.local');
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf-8');
  const vars: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    // Strip surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const dotEnvLocal = readDotEnvLocal();

  // Prefer .env.local values over loadEnv (which can be shadowed by empty system env vars)
  const geminiKey = dotEnvLocal.GEMINI_API_KEY || env.GEMINI_API_KEY || '';
  const geminiKeyFallback = dotEnvLocal.GEMINI_API_KEY_FALLBACK || env.GEMINI_API_KEY_FALLBACK || '';
  const anthropicKey = dotEnvLocal.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY || '';

  return {
    server: {
      port: 3000,
      host: 'localhost',
      proxy: {
        // Proxy Files API requests to avoid CORS issues (beta endpoint lacks preflight support)
        '/api/anthropic-files': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/anthropic-files/, '/v1/files'),
        },
      },
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(geminiKey),
      'process.env.GEMINI_API_KEY': JSON.stringify(geminiKey),
      'process.env.GEMINI_API_KEY_FALLBACK': JSON.stringify(geminiKeyFallback),
      'process.env.ANTHROPIC_API_KEY': JSON.stringify(anthropicKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      include: ['pdfjs-dist'],
    },
  };
});
