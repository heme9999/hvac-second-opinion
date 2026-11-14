import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: 'https://hvac-second-opinion.pages.dev',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
});
