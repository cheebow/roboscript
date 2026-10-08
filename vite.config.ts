import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative paths, so that the built game works wherever it is put: at the top of a site,
  // or under a path such as GitHub Pages' https://<user>.github.io/roboscript/.
  base: './',
  build: {
    rolldownOptions: {
      // Three pages: the game, the introduction and the help on its own.
      input: {
        main: 'index.html',
        about: 'about.html',
        help: 'help.html',
      },
      output: {
        codeSplitting: {
          // The editor's library in a file of its own: it changes far less often than
          // the game, so a returning player's browser keeps it across the game's updates.
          groups: [{ name: 'editor', test: /node_modules[\\/]@(codemirror|lezer)[\\/]/ }],
        },
      },
    },
  },
  test: {
    // Some tests play hundreds of whole matches: a few seconds here, longer on a slower machine such as CI's.
    testTimeout: 60_000,
  },
});
