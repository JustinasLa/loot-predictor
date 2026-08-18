import { defineConfig } from 'vite';

// Relative base so the same build works from a domain root (Vercel)
// and from a repo subpath (GitHub Pages: /loot-predictor/).
export default defineConfig({
  base: './',
});
