# AI Tool Call Tests

Manual tests that validate all AI models can correctly execute tool calls with the expected arguments.

## Overview

These tests make real API calls to all enabled AI providers (OpenAI, Anthropic, Google, etc.) to verify that each model correctly interprets prompts and returns the expected tool calls with accurate arguments.

**Important**: These tests incur actual API costs. Always run the cost estimate first.

## Files

| File | Description |
|------|-------------|
| `aiToolCalls.manual.test.ts` | Main Jest test file that runs tool call tests across all enabled models |
| `toolCallTestCases.ts` | Test case definitions for each AI tool (prompts, expected arguments) |
| `estimateCost.ts` | Standalone script to estimate test costs without making API calls |
| `testResults.cache.json` | Cache of passed tests (gitignored) - enables skipping previously passed tests |
| `README.md` | This file |

## Commands

### Estimate Costs (Run First!)

Get a cost estimate before running the actual tests:

```bash
cd quadratic-api
npm run test:ai-tools:estimate
```

Example output:
```
================================================================================
AI Tool Call Test - Cost Estimate
================================================================================

Models to test: 5
Tool test cases: 43
Total API calls: 215

TOTAL ESTIMATED COST: $1.84
================================================================================
```

### Run Tests

There are two ways to run the tests:

**Using cache (recommended for iterative testing):**
```bash
cd quadratic-api
npm run test:ai-tools
```
This skips tests that already passed in a previous run. Use this when:
- Fixing specific failing tests
- Re-running after a partial run
- Iterating on test case prompts

**Fresh run (clears cache, runs all tests):**
```bash
cd quadratic-api
npm run test:ai-tools:fresh
```
This clears the cache and runs all tests from scratch. Use this when:
- Running a complete validation
- After changing tool definitions
- Starting a new test session

## Configuration

Edit `aiToolCalls.manual.test.ts` to adjust:

```typescript
const MAX_COST_USD = 5.0;            // Stop tests when this cost is exceeded
const TEST_TIMEOUT_MS = 120000;      // 2 minutes per model's test suite
const PARALLEL_BATCH_SIZE = 3;       // Concurrent tests per model
const ESTIMATED_INPUT_TOKENS = 2000; // For cost estimation
const ESTIMATED_OUTPUT_TOKENS = 500; // For cost estimation
```

## Test Result Caching

The test suite caches test results to `testResults.cache.json` (gitignored). This enables:

- **Skip passed tests**: Subsequent runs skip tests that already passed
- **Re-run only failures**: Cached runs only re-run tests that explicitly failed
- **Cost savings**: Avoid paying for API calls you've already validated

### How it works

1. When a test passes or fails, it's saved to the cache
2. On subsequent cached runs:
   - **Passed tests**: Skipped (cached as passed)
   - **Failed tests**: Re-run (to see if they now pass)
   - **Never-run tests**: Skipped (use fresh run to test these)
3. Use `test:ai-tools:fresh` to clear the cache and run all tests

### Cache behavior

| Command | What runs |
|---------|-----------|
| `npm run test:ai-tools` | Only tests that **failed** in the last run |
| `npm run test:ai-tools:fresh` | **All tests** (clears cache first) |

### Typical workflow

1. Run `test:ai-tools:fresh` to test everything (may hit cost limit)
2. Run `test:ai-tools` to re-run only failures
3. Repeat step 2 until all failures are fixed
4. When ready for a full validation, run `test:ai-tools:fresh` again

### Manual cache clearing

To manually clear the cache, delete the file:
```bash
rm quadratic-api/src/ai/tests/testResults.cache.json
```

## Test Cases

Each test case in `toolCallTestCases.ts` defines:

```typescript
{
  tool: AITool.SetCellValues,           // The tool the AI should choose
  prompt: "Put 'Hello' in A1...",       // Prompt that should trigger the tool
  expectedArguments: {                   // Exact arguments expected
    sheet_name: 'Sheet1',
    top_left_position: 'A1',
    cell_values: [['Hello']],
  },
  requiredArguments: ['sheet_name'],    // Optional: must be present
  exactMatch: true,                      // Default true; false for flexible matching
}
```

### Natural Tool Selection

The tests use **natural tool selection** - we don't force the AI to use a specific tool via `tool_choice`. Instead, we:

1. Give the AI a prompt designed to trigger a specific tool
2. Validate that the AI chose the correct tool
3. Validate that the arguments are correct

This approach:
- Tests both tool selection AND argument generation
- Works with all models including Anthropic thinking models
- Is more realistic to production behavior
- May occasionally be flaky if the AI picks a different (but valid) tool

### Adding New Test Cases

1. Add a new entry to `toolCallTestCases` array in `toolCallTestCases.ts`
2. Use explicit, unambiguous prompts that tell the model exactly what tool and arguments to use
3. Set `exactMatch: false` if the model might return equivalent but differently formatted values

## Output

### During Tests

```
Model: azure-openai:gpt-5-codex failures:
  - set_code_cell_value: Argument 'code_string': expected "print('hello')", got "print(\"hello\")"
```

### Final Report

```
================================================================================
AI Tool Call Test Results
================================================================================

Model: azure-openai:gpt-5-codex
  Cost: $0.0234 | Ran: 3 | Failed: 1 | Skipped: 40 cached, 0 never run
  Failures:
    ✗ set_code_cell_value: Argument 'code_string': expected "print('hello')", got "print(\"hello\")"

================================================================================
Summary: 35 tests ran, 5 failed
  Skipped: 180 cached as passed, 0 never run
Total actual cost: $0.4234
Estimated cost (for 35 tests run): $0.3452
Accuracy: 122.6% of estimate
💡 Run with 'npm run test:ai-tools:fresh' to clear cache and re-run all tests
================================================================================
```

## Which Models Are Tested?

Models are included if they meet these criteria in `MODELS_CONFIGURATION`:
- `mode !== 'disabled'` (modes: `'fast'`, `'max'`, `'others'`)
- `canStreamWithToolCalls === true`

Currently enabled modes are typically `'others'` and `'max'`.

## Which Tools Are Tested?

All tools where `sources.includes('AIAnalyst')` in `aiToolsSpec`. This covers ~43 tools including:

- Cell operations: `SetCellValues`, `GetCellData`, `MoveCells`, `DeleteCells`
- Data tables: `AddDataTable`, `ConvertToTable`, `TableMeta`, `TableColumnSettings`
- Code cells: `SetCodeCellValue`, `SetFormulaCellValue`, `SetSQLCodeCellValue`
- Sheet operations: `AddSheet`, `RenameSheet`, `DeleteSheet`, `DuplicateSheet`
- Formatting: `SetTextFormats`, `SetBorders`, `ResizeColumns`, `ResizeRows`
- Validations: `AddLogicalValidation`, `AddListValidation`, `AddNumberValidation`
- And more...

## Environment Requirements

All provider API keys must be configured in `.env`:

```
OPENAI_API_KEY=...
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=...
ANTHROPIC_API_KEY=...
GCP_PROJECT_ID=...
GCP_CLIENT_EMAIL=...
GCP_PRIVATE_KEY=...
AWS_S3_ACCESS_KEY_ID=...
AWS_S3_SECRET_ACCESS_KEY=...
# etc.
```

## Troubleshooting

### Tests are too slow
- Increase `PARALLEL_BATCH_SIZE` (but watch for rate limits)
- Focus on specific models by modifying `getEnabledModels()`

### Tests are flaky
- Set `exactMatch: false` for test cases with variable formatting
- Make prompts more explicit about expected argument format

### Cost limit exceeded
- Increase `MAX_COST_USD` or run fewer tests
- Use `test:ai-tools:estimate` to plan your test runs

### Missing module errors
- Run `npm install` in `quadratic-api`
- Restart TypeScript server in your IDE
