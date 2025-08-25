module.exports = {
  preset: 'ts-jest',
  verbose: true,
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@quadratic-shared/(.*)$': '<rootDir>/../quadratic-shared/$1',
  },
  roots: ['<rootDir>', '<rootDir>/../quadratic-shared'],
  testTimeout: 15000,
};
