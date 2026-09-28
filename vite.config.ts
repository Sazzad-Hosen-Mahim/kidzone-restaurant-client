import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // `import.meta.dirname` rather than `__dirname`, so the config still loads
    // once Vite's native config loader becomes the default.
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    port: 5173,
    // The API is on a different origin, so every request is cross-origin and
    // needs the refresh cookie to travel with it. The backend's CORS allow-list
    // includes http://localhost:5173 by default; keep this port in step with it.
    strictPort: true,
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        // Recharts is large and changes rarely, and the framework packages never
        // change between deploys; splitting them out keeps the main bundle small
        // and cacheable across releases.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('recharts') || id.includes('d3-')) return 'charts';
          if (id.includes('@reduxjs') || id.includes('react-redux')) return 'redux';
          if (id.includes('react-router') || id.includes('/react-dom/') || id.includes('/react/')) return 'react';
          return undefined;
        },
      },
    },
  },
});
