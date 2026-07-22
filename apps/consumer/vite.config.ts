import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

function swBuildHashPlugin() {
  let swSource;

  return {
    name: 'sw-build-hash',
    buildStart() {
      const srcPath = path.resolve('static/sw.js');
      if (fs.existsSync(srcPath)) {
        swSource = fs.readFileSync(srcPath, 'utf-8');
      }
    },
    configureServer(server) {
      if (!swSource) {
        const srcPath = path.resolve('static/sw.js');
        if (fs.existsSync(srcPath)) {
          swSource = fs.readFileSync(srcPath, 'utf-8');
        }
      }
      const hash = Math.random().toString(36).slice(2, 8);
      server.middlewares.use('/sw.js', (_req, res) => {
        const content = (swSource || '').replace('__BUILD_HASH__', hash);
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(content);
      });
    },
    closeBundle() {
      const outPath = path.resolve('build/sw.js');
      if (fs.existsSync(outPath)) {
        const hash = Math.random().toString(36).slice(2, 8);
        let content = fs.readFileSync(outPath, 'utf-8');
        content = content.replace('__BUILD_HASH__', hash);
        fs.writeFileSync(outPath, content);
      }
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), swBuildHashPlugin(), sveltekit()],
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://localhost:5173',
        changeOrigin: true,
      },
    },
  },
});