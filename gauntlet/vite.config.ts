import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Mobile-first PWA: installable to home screen, offline shell, served at root.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Dugout Gauntlet',
        short_name: 'Gauntlet',
        description: 'Draft a team. Run the gauntlet. See how far you go.',
        theme_color: '#0b1220',
        background_color: '#0b1220',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
});
