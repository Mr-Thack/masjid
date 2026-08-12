import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const PORT = parseInt(process.env.PORT || '5174', 10);
const API_PORT = process.env.API_PORT || '5173';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: PORT,
    proxy: {
      '/api': {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
});
