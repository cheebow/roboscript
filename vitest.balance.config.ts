import { defineConfig } from 'vitest/config';

// `npm run balance`: plays the parts against each other and prints how they fare.
// Kept out of `npm test`, which only picks up *.test.ts.
export default defineConfig({
  test: { include: ['tests/balance.report.ts'], testTimeout: 0, disableConsoleIntercept: true },
});
