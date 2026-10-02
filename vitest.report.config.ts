import { defineConfig } from 'vitest/config';

// `npm run balance` and `npm run results`: play many matches and print how they went.
// Kept out of `npm test`, which only picks up *.test.ts.
export default defineConfig({
  test: { include: ['tests/*.report.ts'], testTimeout: 0, disableConsoleIntercept: true },
});
