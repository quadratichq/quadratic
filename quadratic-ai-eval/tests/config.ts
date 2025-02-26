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
    elementVisibility: 15000,
    generation: 300000 // 5 minutes max for AI generation
  },
  
  // Models configuration - enable as many as needed
  models: [
    {
      provider: 'anthropic',
      id: 'claude-3-7-sonnet-20250219',
      maxTokens: 1000,
      temperature: 0.2,
      systemPrompt: `You are an expert evaluator of data visualizations with extensive experience in spreadsheet analysis.
Your task is to objectively evaluate if a spreadsheet visualization meets the requirements of a prompt.
Always respond with valid JSON in the exact format requested, without any preamble, explanations outside the JSON, or markdown formatting.
Focus exclusively on what is visible in the image provided, not what you think should be there.`,
      evaluationPrompt: `
I'm showing you a screenshot of a Quadratic spreadsheet that was generated from the prompt: "{promptText}".

Carefully analyze the image and evaluate if the result correctly implements what was requested in the prompt.

Specific criteria to evaluate:
{criteriaText}

For each criterion, provide a satisfaction score from 0-100, where:
- 0: The criterion is not met at all
- 50: The criterion is partially met
- 100: The criterion is fully met

Provide your evaluation in this exact JSON format:
{
  "criteria_evaluations": [
    {"criterion": "Criterion 1", "satisfaction_score": 85, "explanation": "Brief explanation"},
    {"criterion": "Criterion 2", "satisfaction_score": 50, "explanation": "Brief explanation"},
    ...
  ],
  "overall_satisfaction": 75,
  "explanation": "Your detailed explanation summarizing your evaluation"
}

Your response must be valid JSON that can be parsed programmatically.
`
    },
    {
      provider: 'openai',
      id: 'gpt-4o',
      maxTokens: 1000,
      temperature: 0.2,
      systemPrompt: `You are an expert evaluator of data visualizations with extensive experience in spreadsheet analysis.
Your task is to objectively evaluate if a spreadsheet visualization meets the requirements of a prompt.
Always respond with valid JSON in the exact format requested, without any preamble, explanations outside the JSON, or markdown formatting.
Focus exclusively on what is visible in the image provided, not what you think should be there.`,
      evaluationPrompt: `
I'm showing you a screenshot of a Quadratic spreadsheet that was generated from the prompt: "{promptText}".

Carefully analyze the image and evaluate if the result correctly implements what was requested in the prompt.

Specific criteria to evaluate:
{criteriaText}

For each criterion, provide a satisfaction score from 0-100, where:
- 0: The criterion is not met at all
- 50: The criterion is partially met
- 100: The criterion is fully met

Provide your evaluation in this exact JSON format:
{
  "criteria_evaluations": [
    {"criterion": "Criterion 1", "satisfaction_score": 85, "explanation": "Brief explanation"},
    {"criterion": "Criterion 2", "satisfaction_score": 50, "explanation": "Brief explanation"},
    ...
  ],
  "overall_satisfaction": 75,
  "explanation": "Your detailed explanation summarizing your evaluation"
}

Your response must be valid JSON that can be parsed programmatically.
`
    }
  ],
  
  // Test execution
  execution: {
    // Set to true to run tests in parallel, false to run sequentially
    parallel: true,
    // Maximum number of parallel tests (if parallel is true)
    maxWorkers: 4,
    // Simple scoring configuration
    scoring: {
      // Enable scoring
      enabled: true,
      // Threshold for passing (0.0 to 100.0) - test passes if average satisfaction score >= threshold
      passThreshold: 80
    }
  },
  
  // URLs
  urls: {
    baseUrl: 'https://qa.quadratic-preview.com',
    createFileWithPrompt: '/files/create?prompt='
  }
};

export default config; 