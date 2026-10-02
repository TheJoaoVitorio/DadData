import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // Main-Process entry file of the Electron App.
        entry: 'src/main/index.ts',
        onstart(options) {
          options.startup();
        },
        vite: {
          build: {
            outDir: 'dist-electron/main',
            rollupOptions: {
              external: ['electron', 'exceljs', 'sql.js', 'node-firebird']
            }
          },
          resolve: {
            alias: {
              '@shared': path.resolve(__dirname, 'src/shared'),
              '@drivers': path.resolve(__dirname, 'src/drivers')
            }
          }
        },
      },
      {
        entry: 'src/preload/index.ts',
        onstart(args) {
          // Notify the Renderer-Process to reload the page when the Preload-Scripts build is complete
          args.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron/preload',
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer/src'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@drivers': path.resolve(__dirname, 'src/drivers')
    },
  },
  server: {
    port: 5173,
  },
  // @ts-ignore vitest
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
