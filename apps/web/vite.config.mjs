import { defineConfig } from 'vite';
import { createWebBuildDefinition } from './web-build-definition.mjs';

export default defineConfig({
  ...createWebBuildDefinition(),
  server: {
    proxy: {
      '/api/v1': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
});
