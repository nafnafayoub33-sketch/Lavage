/**
 * tests/setup.ts
 *
 * AsyncStorage is native, so it has to be faked in a Node test process. The
 * package ships its own mock — an in-memory store with the real async
 * signatures — which is what makes the pendingRole tests meaningful rather
 * than a test of the mock.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
