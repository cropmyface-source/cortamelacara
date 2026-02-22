import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  // Producción desplegada en S3 bajo Aplicaciones/CropApp4/dist
  base: 'https://especialess3.lanacion.com.ar/Aplicaciones/CropApp7/dist/',
  plugins: [vue()],
});
