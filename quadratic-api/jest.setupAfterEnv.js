// Setup that runs after Jest environment is initialized
// This has access to Jest globals like afterAll, beforeAll, etc.

// Global cleanup for each test suite
afterAll(async () => {
  try {
    const dbClient = require('./src/dbClient').default;
    await dbClient.$disconnect();
  } catch (error) {
    // Ignore errors during cleanup
    console.warn('Warning: Error during test cleanup:', error.message);
  }
});
