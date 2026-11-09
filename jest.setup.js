jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

// Tests never reach the network. Replacing Expo's lazy fetch also stops it
// loading native modules after a test has finished.
Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  writable: true,
  value: jest.fn(() => Promise.reject(new Error('Network is disabled in tests'))),
});
