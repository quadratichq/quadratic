/**
 * Manual AI Tool Call Tests
 *
 * This file tests that all AI models can correctly execute tool calls.
 * It loops through enabled models and verifies each returns the expected tool call with correct arguments.
 *
 * Run with: npm run test:ai-tools (uses cache, skips previously passed tests)
 *           npm run test:ai-tools:fresh (clears cache, runs all tests)
 *
 * Environment: Requires valid API credentials for all providers
 * Cost: Each run incurs API costs - a max cost limit is enforced
 */

import * as fs from 'fs';
import * as path from 'path';
import { MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import { aiToolsSpec, type AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIModelKey, AIRequestHelperArgs, ParsedAIResponse } from 'quadratic-shared/typesAndSchemasAI';
import { handleAIRequest } from '../handler/ai.handler';
import { calculateUsage } from '../helpers/usage.helper';
import { toolCallTestCases, type ToolCallTestCase } from './toolCallTestCases';

// Cache configuration
const CACHE_FILE_PATH = path.join(__dirname, 'testResults.cache.json');
const CLEAR_CACHE = process.env.CLEAR_CACHE === 'true';

interface CachedTestResult {
  passed: boolean;
  timestamp: number;
  cost: number;
}

interface TestCache {
  version: number;
  results: Record<string, CachedTestResult>; // key: "modelKey:tool"
}

/**
 * Load the test cache from disk
 */
function loadCache(): TestCache {
  if (CLEAR_CACHE) {
    console.log('🗑️  Cache cleared (CLEAR_CACHE=true)\n');
    return { version: 1, results: {} };
  }

  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const data = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
      const cache = JSON.parse(data) as TestCache;
      const passedCount = Object.values(cache.results).filter((r) => r.passed).length;
      const failedCount = Object.values(cache.results).filter((r) => !r.passed).length;
      if (passedCount > 0 || failedCount > 0) {
        const parts: string[] = [];
        if (passedCount > 0) parts.push(`${passedCount} passed`);
        if (failedCount > 0) parts.push(`${failedCount} failed (will re-run)`);
        console.log(`📦 Loaded cache: ${parts.join(', ')}\n`);
      }
      return cache;
    }
  } catch (error) {
    console.warn('⚠️  Failed to load cache, starting fresh:', error);
  }
  return { version: 1, results: {} };
}

/**
 * Save the test cache to disk
 */
function saveCache(cache: TestCache): void {
  try {
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (error) {
    console.warn('⚠️  Failed to save cache:', error);
  }
}

/**
 * Get a cache key for a model/tool combination
 */
function getCacheKey(modelKey: AIModelKey, tool: AITool): string {
  return `${modelKey}:${tool}`;
}

/**
 * Check if a test should be skipped based on cache
 * - Fresh run (CLEAR_CACHE=true): Run ALL tests
 * - Cached run:
 *   - Skip if passed (cached as passed: true)
 *   - Skip if never run (not in cache) - only re-run explicit failures
 *   - Run only if explicitly failed (cached as passed: false)
 */
function shouldSkipTest(cache: TestCache, modelKey: AIModelKey, tool: AITool): boolean {
  // Fresh run - run everything
  if (CLEAR_CACHE) {
    return false;
  }

  const key = getCacheKey(modelKey, tool);
  const cached = cache.results[key];

  // If not in cache, skip (use fresh run to test new tests)
  if (cached === undefined) {
    return true;
  }

  // If cached as passed, skip
  // If cached as failed, run (return false)
  return cached.passed === true;
}

// Global cache instance
let testCache: TestCache;

// Configuration
const MAX_COST_USD = 20.0; // Maximum cost allowed for the entire test run
const TEST_TIMEOUT_MS = 120000; // 2 minutes per test
const PARALLEL_BATCH_SIZE = 3; // Number of parallel tests per model

// Track total cost across all tests
let totalCost = 0;
const costLock = { exceeded: false };

interface TestResult {
  modelKey: AIModelKey;
  tool: AITool;
  success: boolean;
  error?: string;
  cost: number;
  duration: number;
  response?: ParsedAIResponse;
  skipped?: boolean; // True if test was skipped due to cache hit (passed)
  skippedNotRun?: boolean; // True if test was skipped because it was never run before
}

/**
 * Get all enabled models that support tool calling
 */
function getEnabledModels(): AIModelKey[] {
  return (Object.entries(MODELS_CONFIGURATION) as [AIModelKey, (typeof MODELS_CONFIGURATION)[AIModelKey]][])
    .filter(([_, config]) => {
      // Only include models that are not disabled and support tool calls with streaming
      return config.mode !== 'disabled' && config.canStreamWithToolCalls;
    })
    .map(([key]) => key);
}

/**
 * Get tools that are available for AIAnalyst source (most tools)
 */
function getTestableTools(): AITool[] {
  return (Object.entries(aiToolsSpec) as [AITool, (typeof aiToolsSpec)[AITool]][])
    .filter(([_, spec]) => {
      // Only test tools available to AIAnalyst
      return spec.sources.includes('AIAnalyst');
    })
    .map(([tool]) => tool);
}

/**
 * Build a request payload for testing a specific tool
 */
function buildTestRequest(modelKey: AIModelKey, testCase: ToolCallTestCase): AIRequestHelperArgs {
  // Use streaming for Anthropic models to avoid timeout errors
  // Anthropic SDK requires streaming for operations that may take > 10 minutes
  const isAnthropicModel =
    modelKey.includes('anthropic') || modelKey.includes('claude') || modelKey.includes('bedrock-anthropic');

  const args: AIRequestHelperArgs = {
    source: 'AIAnalyst',
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: testCase.prompt }],
        contextType: 'userPrompt',
      },
    ],
    useStream: isAnthropicModel, // Use streaming for Anthropic to avoid SDK timeout errors
    // Note: We don't force tool use (toolName) - let the AI naturally select the tool
    // This tests both tool selection AND argument generation
    useToolsPrompt: true,
    useQuadraticContext: false,
  };

  return args;
}

/**
 * Validate that the response contains the expected tool call with correct arguments
 */
function validateResponse(
  response: ParsedAIResponse | undefined,
  testCase: ToolCallTestCase
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!response) {
    return {
      valid: false,
      errors: ['No response received (API error or missing credentials - check server logs)'],
    };
  }

  // Check if response has tool calls
  const toolCalls = response.responseMessage.toolCalls;
  if (!toolCalls || toolCalls.length === 0) {
    return { valid: false, errors: ['No tool calls in response'] };
  }

  // Find the expected tool call
  const toolCall = toolCalls.find((tc) => tc.name === testCase.tool);
  if (!toolCall) {
    return {
      valid: false,
      errors: [`Expected tool '${testCase.tool}' not found. Got: ${toolCalls.map((tc) => tc.name).join(', ')}`],
    };
  }

  // Parse the arguments
  let args: Record<string, unknown>;
  try {
    args = typeof toolCall.arguments === 'string' ? JSON.parse(toolCall.arguments) : toolCall.arguments;
  } catch {
    return { valid: false, errors: ['Failed to parse tool call arguments'] };
  }

  // Validate expected arguments
  for (const [key, expectedValue] of Object.entries(testCase.expectedArguments)) {
    const actualValue = args[key];

    if (testCase.exactMatch !== false) {
      // Exact matching (default)
      if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
        errors.push(`Argument '${key}': expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`);
      }
    } else {
      // Loose matching - just check the key exists and has the right type
      if (actualValue === undefined) {
        errors.push(`Argument '${key}': expected to exist but was undefined`);
      } else if (typeof actualValue !== typeof expectedValue) {
        errors.push(`Argument '${key}': expected type ${typeof expectedValue}, got ${typeof actualValue}`);
      }
    }
  }

  // Check for required arguments that are missing
  for (const requiredKey of testCase.requiredArguments || []) {
    if (args[requiredKey] === undefined) {
      errors.push(`Required argument '${requiredKey}' is missing`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Run a single tool test for a model
 */
async function runToolTest(modelKey: AIModelKey, testCase: ToolCallTestCase): Promise<TestResult> {
  const startTime = Date.now();
  const key = getCacheKey(modelKey, testCase.tool);
  const cached = testCache.results[key];

  // Check cache - skip if already passed or never run (only re-run failures)
  if (shouldSkipTest(testCache, modelKey, testCase.tool)) {
    // Distinguish between "passed" and "never run"
    if (cached === undefined) {
      // Never run - skip but mark as not run
      return {
        modelKey,
        tool: testCase.tool,
        success: true, // Treat as success for Jest (not a failure)
        cost: 0,
        duration: 0,
        skipped: true,
        skippedNotRun: true,
      };
    }
    // Passed - skip
    return {
      modelKey,
      tool: testCase.tool,
      success: true,
      cost: cached.cost || 0,
      duration: 0,
      skipped: true,
    };
  }

  // Check cost limit before running
  if (costLock.exceeded) {
    return {
      modelKey,
      tool: testCase.tool,
      success: false,
      error: 'Cost limit exceeded - test skipped',
      cost: 0,
      duration: 0,
    };
  }

  try {
    const args = buildTestRequest(modelKey, testCase);

    let response;
    try {
      response = await handleAIRequest({
        modelKey,
        args,
        isOnPaidPlan: true,
        exceededBillingLimit: false,
      });

      // Debug: log if we got no response (indicates silent error in handler)
      if (!response) {
        console.error(`[DEBUG] ${modelKey}/${testCase.tool}: handleAIRequest returned undefined (check server logs for errors)`);
      }
    } catch (apiError) {
      // Capture API-level errors with more detail
      const duration = Date.now() - startTime;
      const errorMessage =
        apiError instanceof Error
          ? `API Error: ${apiError.name}: ${apiError.message}`
          : `API Error: ${String(apiError)}`;
      console.error(`[DEBUG] ${modelKey}/${testCase.tool}: ${errorMessage}`);
      return {
        modelKey,
        tool: testCase.tool,
        success: false,
        error: errorMessage,
        cost: 0,
        duration,
      };
    }

    const duration = Date.now() - startTime;

    // Calculate cost
    const cost = response?.usage ? calculateUsage(response.usage) : 0;
    totalCost += cost;

    // Check if we've exceeded the cost limit
    if (totalCost > MAX_COST_USD) {
      costLock.exceeded = true;
    }

    // Validate the response
    const validation = validateResponse(response, testCase);

    return {
      modelKey,
      tool: testCase.tool,
      success: validation.valid,
      error: validation.errors.length > 0 ? validation.errors.join('; ') : undefined,
      cost,
      duration,
      response,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      modelKey,
      tool: testCase.tool,
      success: false,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      cost: 0,
      duration,
    };
  }
}

/**
 * Update the cache with a test result
 */
function updateCache(result: TestResult): void {
  if (result.skipped || result.skippedNotRun) return; // Don't update cache for skipped tests

  const key = getCacheKey(result.modelKey, result.tool);
  testCache.results[key] = {
    passed: result.success,
    timestamp: Date.now(),
    cost: result.cost,
  };
  // Save cache after each update to persist progress
  saveCache(testCache);
}

/**
 * Run tests for a single model across all tools
 */
async function runModelTests(modelKey: AIModelKey, testCases: ToolCallTestCase[]): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Run tests in batches for parallelism within a model
  for (let i = 0; i < testCases.length; i += PARALLEL_BATCH_SIZE) {
    if (costLock.exceeded) break;

    const batch = testCases.slice(i, i + PARALLEL_BATCH_SIZE);
    const batchResults = await Promise.all(batch.map((testCase) => runToolTest(modelKey, testCase)));

    // Update cache for each result
    for (const result of batchResults) {
      updateCache(result);
    }

    results.push(...batchResults);
  }

  return results;
}

/**
 * Generate test report
 */
function generateReport(allResults: TestResult[]): void {
  const lines: string[] = [];
  lines.push('\n' + '='.repeat(80));
  lines.push('AI Tool Call Test Results');
  lines.push('='.repeat(80) + '\n');

  // Group results by model
  const byModel = new Map<AIModelKey, TestResult[]>();
  for (const result of allResults) {
    const existing = byModel.get(result.modelKey) || [];
    existing.push(result);
    byModel.set(result.modelKey, existing);
  }

  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkippedPassed = 0;
  let totalSkippedNotRun = 0;

  for (const [modelKey, results] of byModel) {
    const passed = results.filter((r) => r.success && !r.skipped).length;
    const skippedPassed = results.filter((r) => r.skipped && !r.skippedNotRun).length;
    const skippedNotRun = results.filter((r) => r.skippedNotRun).length;
    const failed = results.filter((r) => !r.success).length;
    const modelCost = results.reduce((sum, r) => sum + (r.skipped ? 0 : r.cost), 0);

    totalPassed += passed;
    totalFailed += failed;
    totalSkippedPassed += skippedPassed;
    totalSkippedNotRun += skippedNotRun;

    lines.push(`Model: ${modelKey}`);
    const skipParts: string[] = [];
    if (skippedPassed > 0) skipParts.push(`${skippedPassed} cached`);
    if (skippedNotRun > 0) skipParts.push(`${skippedNotRun} never run`);
    const skippedStr = skipParts.length > 0 ? ` | Skipped: ${skipParts.join(', ')}` : '';
    lines.push(`  Cost: $${modelCost.toFixed(4)} | Ran: ${passed + failed} | Failed: ${failed}${skippedStr}`);

    // Only show failures to reduce output
    const failures = results.filter((r) => !r.success);
    if (failures.length > 0) {
      lines.push(`  Failures:`);
      for (const result of failures) {
        lines.push(`    ✗ ${result.tool}: ${result.error}`);
      }
    }
    lines.push('');
  }

  lines.push('='.repeat(80));
  const totalRan = totalPassed + totalFailed;
  lines.push(`Summary: ${totalRan} tests ran, ${totalFailed} failed`);
  if (totalSkippedPassed > 0 || totalSkippedNotRun > 0) {
    const skipDetails: string[] = [];
    if (totalSkippedPassed > 0) skipDetails.push(`${totalSkippedPassed} cached as passed`);
    if (totalSkippedNotRun > 0) skipDetails.push(`${totalSkippedNotRun} never run`);
    lines.push(`  Skipped: ${skipDetails.join(', ')}`);
  }
  lines.push(`Total actual cost: $${totalCost.toFixed(4)}`);
  lines.push(`Max cost limit: $${MAX_COST_USD}`);

  if (costLock.exceeded) {
    lines.push(`⚠️  Cost limit of $${MAX_COST_USD} was exceeded - some tests were skipped`);
  }
  if (totalSkippedNotRun > 0) {
    lines.push(`⚠️  ${totalSkippedNotRun} tests were never run (use 'npm run test:ai-tools:fresh' to run all)`);
  }
  if (totalSkippedPassed > 0) {
    lines.push(`💡 Run with 'npm run test:ai-tools:fresh' to clear cache and re-run all tests`);
  }
  lines.push('='.repeat(80) + '\n');

  // Single console.log for entire report
  console.log(lines.join('\n'));
}

// Check for required environment variables
function checkCredentials(): void {
  const warnings: string[] = [];

  // GCP/Vertex AI Anthropic
  if (!process.env.GCP_PROJECT_ID || process.env.GCP_PROJECT_ID === 'GCP_PROJECT_ID') {
    warnings.push('GCP_PROJECT_ID not set - vertexai-anthropic models will fail');
  }
  if (!process.env.GCP_CLIENT_EMAIL || process.env.GCP_CLIENT_EMAIL === 'GCP_CLIENT_EMAIL') {
    warnings.push('GCP_CLIENT_EMAIL not set - vertexai-anthropic models will fail');
  }
  if (!process.env.GCP_PRIVATE_KEY || process.env.GCP_PRIVATE_KEY === 'GCP_PRIVATE_KEY') {
    warnings.push('GCP_PRIVATE_KEY not set - vertexai-anthropic models will fail');
  }

  // Azure OpenAI
  if (!process.env.AZURE_OPENAI_API_KEY) {
    warnings.push('AZURE_OPENAI_API_KEY not set - azure-openai models will fail');
  }

  if (warnings.length > 0) {
    console.warn('\n⚠️  CREDENTIAL WARNINGS:\n  ' + warnings.join('\n  ') + '\n');
  }
}

// Jest test suite
describe('AI Tool Calls Manual Tests', () => {
  const enabledModels = getEnabledModels();
  const testableTools = getTestableTools();
  const allResults: TestResult[] = [];

  // Filter test cases to only include testable tools
  const testCases = toolCallTestCases.filter((tc) => testableTools.includes(tc.tool));

  // Initialize cache
  testCache = loadCache();

  // Check credentials before running tests
  checkCredentials();

  // Create a test for each model
  for (const modelKey of enabledModels) {
    describe(`Model: ${modelKey}`, () => {
      it(
        'should correctly execute all tool calls',
        async () => {
          const results = await runModelTests(modelKey, testCases);
          allResults.push(...results);

          // Fail the test if there were failures
          const failures = results.filter((r) => !r.success);
          const passed = results.filter((r) => r.success).length;
          if (failures.length > 0) {
            throw new Error(
              `${failures.length}/${results.length} tool calls failed for ${modelKey}:\n` +
                failures.map((f) => `  - ${f.tool}: ${f.error}`).join('\n')
            );
          }
          expect(passed).toBe(results.length);
        },
        TEST_TIMEOUT_MS * testCases.length
      );
    });
  }

  // After all tests, generate report
  afterAll(() => {
    generateReport(allResults);
  });
});

// Export for direct execution
export { generateReport, getEnabledModels, getTestableTools, runModelTests };
