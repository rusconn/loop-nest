//@ts-check

import AstroPWA from "@vite-pwa/astro";
import { defineConfig } from "astro/config";

export default defineConfig({
  integrations: [
    AstroPWA({
      registerType: "autoUpdate",
      includeAssets: ["5-seconds-of-silence.mp3", "favicon.svg", "icons.svg"],
      workbox: {
        navigateFallback: "/",
        // In dev mode, dev-dist/ contains no matching real files, causing
        // a Workbox glob warning. Empty array avoids the warning.
        globPatterns:
          process.argv.includes("dev") || process.argv.includes("dev-server")
            ? []
            : ["**/*.{css,js,html,svg,png,ico,mp3,woff2}"],
      },
      devOptions: {
        enabled: true,
        navigateFallbackAllowlist: [/^\/$/],
      },
      manifest: {
        name: "Game Music Player",
        short_name: "Game Music Player",
        start_url: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#111",
        theme_color: "#111",
        icons: [
          {
            src: "/pwa-icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
});
