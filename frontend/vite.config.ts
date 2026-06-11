import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxy API calls to the NestJS backend during development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/videos': 'http://localhost:3000',
      '/chat': 'http://localhost:3000',
      '/emotion': 'http://localhost:3000',
      '/me': 'http://localhost:3000',
    },
  },
});
