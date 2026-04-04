import { fileURLToPath, URL } from 'node:url';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const host = process.env.TAURI_DEV_HOST;

export const injectReactDevtools = (): Plugin => {
  return {
    name: 'inject-react-devtools',
    apply: 'serve',
    transformIndexHtml(html) {
      if (!process.env.VITE_USE_DEVTOOLS) {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: 'script',
            injectTo: 'head',
            attrs: { src: 'http://localhost:8097' },
          },
        ],
      };
    },
  };
};

export default defineConfig(async () => ({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    injectReactDevtools(),
  ],
  clearScreen: false,
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
}));
