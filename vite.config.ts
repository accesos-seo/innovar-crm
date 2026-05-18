import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import {defineConfig, loadEnv} from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, __dirname, '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react':   ['react', 'react-dom', 'react-router-dom'],
            'vendor-query':   ['@tanstack/react-query'],
            'vendor-table':   ['@tanstack/react-table'],
            'chunk-charts':   ['recharts'],
            'chunk-dnd':      ['@hello-pangea/dnd'],
            'chunk-pdf':      ['jspdf', 'html2canvas'],
            'chunk-motion':   ['framer-motion'],
            'chunk-supabase': ['@supabase/supabase-js'],
            'chunk-forms':    ['react-hook-form', '@hookform/resolvers', 'zod'],
          },
        },
      },
    },
  };
});
