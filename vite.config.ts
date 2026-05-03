import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const githubPagesBasePaths: Record<string, string> = {
  'Shiminize/TheFrictionoftheSpark.v2': '/TheFrictionoftheSpark.v2/',
  'Shiminize/pocketreader': '/pocketreader/'
};

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? githubPagesBasePaths[process.env.GITHUB_REPOSITORY || ''] || '/' : '/',
  plugins: [react()],
  build: {
    outDir: 'dist'
  },
  test: {
    environment: 'jsdom',
    globals: true
  }
});
