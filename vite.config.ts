import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths, so that the built game works wherever it is put: at the top of a site,
  // or under a path such as GitHub Pages' https://<user>.github.io/roboscript/.
  base: './',
});
