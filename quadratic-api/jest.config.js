module.exports = {
  preset: 'ts-jest',
  verbose: true,
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  setupFiles: ['<rootDir>/jest.setup.js'],
};
