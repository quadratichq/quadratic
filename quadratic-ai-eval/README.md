# Quadratic AI Evaluation Framework

This framework allows you to test Quadratic's AI capabilities by running multiple prompts in parallel and evaluating the results using Claude.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
# Create a .env file with your Anthropic API key
echo "ANTHROPIC_API_KEY=your_api_key_here" > .env
```

## Running Tests

To run all tests:
```bash
npx playwright test
```

To run the prompt evaluation tests specifically:
```bash
npx playwright test prompt-evaluation.spec.ts
# or use the npm script
npm run test:prompt
```

To run tests with a UI:
```bash
npx playwright test --ui
```

## Test Categories

The framework includes different categories of tests:

- **Basic prompts**: Simple data visualization prompts (run with `npm run test:basic`)
- **Complex data prompts**: More complex data analysis prompts (run with `npm run test:complex`)
- **Parallel execution**: Run all tests in parallel (run with `npm run test:parallel`)

## Adding New Tests

To add new test prompts, edit the `tests/prompt-tests.ts` file and add your prompts to the appropriate array:

```typescript
// For basic data visualization prompts
export const testPrompts: PromptTest[] = [
  {
    name: 'Your Test Name',
    prompt: 'Your prompt text here',
    validationCriteria: [
      'Criterion 1?',
      'Criterion 2?',
      'Criterion 3?',
      'Criterion 4?',
      'Criterion 5?'
    ],
    expectedRating: 'GREEN' // or 'YELLOW' or 'RED'
  },
  // Add more test prompts here
];

// For more complex data analysis prompts
export const complexDataPrompts: PromptTest[] = [
  // Add your complex data prompts here
];
```

### Test Structure

Each test prompt consists of:

- `name`: A descriptive name for the test
- `prompt`: The actual prompt to send to Quadratic
- `validationCriteria`: An array of questions that Claude will use to evaluate the result
- `expectedRating`: The expected rating from Claude (GREEN, YELLOW, or RED)

## How It Works

1. The test framework logs in to Quadratic using Auth0 credentials
2. For each prompt in the test arrays:
   - It navigates to the file creation page with the prompt
   - Waits for the spreadsheet to be generated
   - Takes a screenshot of the result
   - Sends the screenshot to Claude for evaluation
   - Validates that the result meets the expected criteria

## Evaluation Criteria

Claude evaluates each result and provides a rating:

- **GREEN**: The result looks correct and fully satisfies the prompt requirements
- **YELLOW**: The result partially satisfies the prompt but has minor issues
- **RED**: The result is incorrect or has major issues

## Test Reports

Test reports are generated in the `playwright-report` directory. Each test includes:

- The prompt text
- A screenshot of the result
- Claude's evaluation
- The test status (passed/failed)

## Customizing Tests

You can customize the test framework by:

1. Adding new prompt collections in `prompt-tests.ts`
2. Modifying the evaluation criteria
3. Adjusting timeouts and other parameters in `config.ts`

## Troubleshooting

- If tests fail with authentication errors, check your Auth0 credentials
- If Claude evaluation fails, check your Anthropic API key
- If tests time out, you may need to increase the timeout values in the config file 