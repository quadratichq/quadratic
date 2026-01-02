// Global teardown - runs once after all test suites complete
module.exports = async () => {
  try {
    // Force close any remaining database connections
    const dbClient = require('./src/dbClient').default;
    await dbClient.$disconnect();
    console.log('✅ Database connections closed successfully');
  } catch (error) {
    console.warn('⚠️  Warning: Error closing database connections:', error.message);
  }

  // Small delay to ensure cleanup completes
  await new Promise((resolve) => setTimeout(resolve, 100));
};
