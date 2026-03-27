import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['main-logo.png'],
      manifest: {
        name: '디지털 피로 관리',
        short_name: '피로관리',
        description: '디지털 피로를 측정하고 관리하는 모바일 웹앱',
        theme_color: '#A8D672',
        background_color: '#F5F5F5',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        importScripts: ['/sw-custom.js'],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'https://4djrhgquyb.execute-api.us-east-1.amazonaws.com/prod',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
