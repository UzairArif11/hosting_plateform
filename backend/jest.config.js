module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  collectCoverageFrom: [
    'middleware/**/*.js',
    'utils/**/*.js',
    '!**/node_modules/**'
  ],
  // Don't load the full app (which needs MongoDB) for unit tests
  setupFiles: [],
  testTimeout: 10000
};
