// @lovable.dev/vite-tanstack-config already includes the TanStack Start, React, Tailwind and
// TypeScript-path plugins. Keep that wrapper for the current development environment; the official
// Netlify adapter prepares the same app for Netlify's serverless runtime and local primitives.
import netlify from "@netlify/vite-plugin-tanstack-start";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  plugins: [netlify()],
  // The Netlify TanStack adapter owns SSR output; do not emit the inherited Cloudflare Nitro bundle.
  nitro: false,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
});
