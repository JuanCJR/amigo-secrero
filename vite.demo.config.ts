import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Versión demo: un solo HTML con todo adentro y servidor simulado en el navegador.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  define: { 'import.meta.env.VITE_DEMO': '"1"' },
  build: { outDir: 'dist-demo', assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 4000 },
});
