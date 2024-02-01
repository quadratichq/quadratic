import { Config } from 'jest';

const config: Config = {
  verbose: true,
  testEnvironment: 'node',
  preset: 'ts-jest',
  testPathIgnorePatterns: [
    '<rootDir>/tests-e2e/*',
    '<rootDir>/node_modules/',
    '<rootDir>/quadratic-api/*',
    '<rootDir>/quadratic-core/*',
    '.ignore.*',
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/quadratic-core/pkg/package.json',
    '<rootDir>/src/quadratic-core/package.json',
    '<rootDir>/src/quadratic-core/__mocks__/package.json',
    '<rootDir>/build/pyodide/package.json',
  ],
  transform: {},
  testTimeout: 15000,
};

export default config;
