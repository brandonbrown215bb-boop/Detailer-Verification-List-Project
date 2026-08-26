import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    host: true
  },
  assetsInclude: ['**/*.xml', '**/*.xlsx'],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ruleEditor: resolve(__dirname, 'rule-editor.html')
      }
    }
  }
});
