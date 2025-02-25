/**
 * Configuration for the Quadratic AI Evaluation tests
 */

export const config = {
  // Authentication
  auth: {
    email: process.env.AUTH_EMAIL || '',
    password: process.env.AUTH_PASSWORD || '',
    loginUrl: 'https://qa.quadratic-preview.com/',
    redirectUrl: /teams/
  },
  
  // Timeouts (in milliseconds)
  timeouts: {
    navigation: 30000,
    elementVisibility: 10000,
    generation: 300000 // 5 minutes max for AI generation
  },
  
  // Claude API configuration
  claude: {
    model: 'claude-3-7-sonnet-20250219',
    maxTokens: 1000,
    systemPrompt: 'You are an expert evaluator of data visualizations. Always respond with valid JSON in the exact format requested.'
  },
  
  // Test execution
  execution: {
    // Set to true to run tests in parallel, false to run sequentially
    parallel: true,
    // Maximum number of parallel tests (if parallel is true)
    maxWorkers: 4
  },
  
  // URLs
  urls: {
    baseUrl: 'https://qa.quadratic-preview.com',
    createFileWithPrompt: '/files/create?prompt='
  }
};

export default config; 