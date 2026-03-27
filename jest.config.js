module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.property.test.js',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.aws-sam/',
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/index.js',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
};
