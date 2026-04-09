import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    tailwindcss(),
    ...(command === 'build'
      ? [visualizer({ open: false, gzipSize: true, brotliSize: true })]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');
          if (!normalized.includes('node_modules')) return;

          if (
            normalized.includes('/react-dom/') ||
            normalized.includes('/react-router-dom/') ||
            normalized.match(/\/node_modules\/react\//)
          ) {
            return 'vendor-react';
          }
          if (
            normalized.includes('/chart.js/') ||
            normalized.includes('/react-chartjs-2/') ||
            normalized.includes('/node_modules/d3/')
          ) {
            return 'vendor-chart';
          }
          if (
            normalized.includes('/framer-motion/') ||
            normalized.includes('/zustand/') ||
            normalized.includes('/@tanstack/react-query/')
          ) {
            return 'vendor-ui';
          }
        },
      },
    },
  },
}));
