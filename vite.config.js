import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// Relative base so the same build works from a domain root (Vercel)
// and from a repo subpath (GitHub Pages: /loot-predictor/).
export default defineConfig({
  base: './',
  plugins: [tailwindcss()],
});
