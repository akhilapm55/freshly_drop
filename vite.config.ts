import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Freshly Drop is maintained as a plain website — no "install app" prompt.
      //
      // The plugin is kept ONLY to clean up after the earlier PWA build:
      //   manifest: false     removes the web app manifest, which is what made
      //                       Chrome/Edge offer "Install app".
      //   selfDestroying:true ships a service worker whose only job is to
      //                       unregister any previously-installed one and delete
      //                       its caches.
      //
      // Why not just delete this block: a browser that already registered the old
      // service worker would keep serving its cached copy of the site, so those
      // visitors would never see another update. The self-destroying worker
      // releases them. Once the site has been live like this for a few weeks,
      // this whole plugin entry can be removed.
      VitePWA({
        selfDestroying: true,
        injectRegister: 'auto',
        manifest: false,
        devOptions: {enabled: false},
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
