module.exports = {
  preset: 'ts-jest',
  verbose: true,
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '\\.manual\\.test\\.ts$'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setupAfterEnv.js'],
  globalTeardown: '<rootDir>/jest.teardown.js',
  moduleNameMapper: {
    '^@quadratic-shared/(.*)$': '<rootDir>/../quadratic-shared/$1',
  },
  roots: ['<rootDir>', '<rootDir>/../quadratic-shared'],
  testTimeout: 15000,
};
