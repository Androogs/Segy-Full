// Tienda web SEGY (Vite).
//  - Desarrollo: http://localhost:5174 con proxy de /api hacia el backend (puerto 3400), igual que el panel.
//  - Producción: build en dist/. Lo sirve el backend en los dominios de TIENDA_HOSTS, o se publica como sitio estático
//    en cualquier hosting definiendo VITE_SEGY_API=https://panel.tu-dominio.com al compilar.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const BACKEND = process.env.SEGY_BACKEND_URL || 'http://localhost:3400';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: false },
    },
  },
  preview: { port: 4174 },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: ['es2020', 'chrome90', 'firefox90', 'safari15'],
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // three.js va en su propio archivo: solo se descarga cuando la experiencia 3D entra en pantalla.
        manualChunks: (id) => (id.includes('node_modules/three/') ? 'three' : undefined),
      },
    },
  },
});
