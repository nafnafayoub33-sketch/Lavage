/**
 * jest.config.js
 *
 * Tests live in tests/, per docs/ARCHITECTURE.md — queue math and usecases.
 *
 * The jest-expo preset is here rather than a lighter runner because the same
 * config has to cover both the pure usecases and anything touching React
 * Native. Component tests are coming: SCREENS.md rule 2 asks every list screen
 * for four states, and one runner is better than two.
 */
module.exports = {
  preset: 'jest-expo',

  testMatch: ['<rootDir>/tests/**/*.test.ts?(x)'],

  // Mirrors the `@/*` alias in tsconfig.json.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // Only the framework-free code is measured. Screens are not covered yet and
  // a threshold that counts them would just be noise.
  collectCoverageFrom: ['src/core/**/*.ts'],
};
