/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
  // Handle Firebase Functions v2 imports
  moduleNameMapper: {
    '^firebase-functions/v2/https$': '<rootDir>/node_modules/firebase-functions/lib/v2/providers/https',
    '^firebase-functions/logger$': '<rootDir>/node_modules/firebase-functions/lib/logger',
  },
};
