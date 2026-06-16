import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Mobile-first PWA: installable to home screen, offline shell.
// base is '/' locally and on root hosts; the Pages workflow sets DEPLOY_BASE
// to the project subpath (e.g. '/dugout-draft/') so asset URLs resolve there.
const base = process.env.DEPLOY_BASE || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Dugout Gauntlet',
        short_name: 'Gauntlet',
        description: 'Draft a team. Run the gauntlet. See how far you go.',
        theme_color: '#f4f1ea',
        background_color: '#f4f1ea',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        skipWaiting: true,           // new build takes over without waiting for all tabs to close
        clientsClaim: true,
        cleanupOutdatedCaches: true, // don't serve stale bundles
      },
    }),
  ],
});
