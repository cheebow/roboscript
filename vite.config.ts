import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative paths, so that the built game works wherever it is put: at the top of a site,
  // or under a path such as GitHub Pages' https://<user>.github.io/roboscript/.
  base: './',
  test: {
    // Some tests play hundreds of whole matches: a few seconds here, longer on a slower machine such as CI's.
    testTimeout: 60_000,
  },
});
