/**
 * Standalone script to estimate the cost of running AI tool call tests
 *
 * Run with: npm run test:ai-tools:estimate
 *
 * The estimate uses historical data from the cache when available,
 * and accounts for which tests will actually run vs be skipped.
 */

import * as fs from 'fs';
import * as path from 'path';
import { MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import type { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIModelKey } from 'quadratic-shared/typesAndSchemasAI';
import { toolCallTestCases } from './toolCallTestCases';

// Configuration (keep in sync with main test file)
const MAX_COST_USD = 20.0;
const CACHE_FILE_PATH = path.join(__dirname, 'testResults.cache.json');
const CLEAR_CACHE = process.env.CLEAR_CACHE === 'true';

// Fallback estimates when no cache data exists
// These are based on observed actual costs (much higher than simple token estimates)
const FALLBACK_COST_PER_TEST: Record<string, number> = {
  // Claude models with thinking use significantly more tokens
  'vertexai-anthropic': 0.065, // ~$0.06 per test observed
  'bedrock-anthropic': 0.065,
  anthropic: 0.065,
  // OpenAI/Azure models
  'azure-openai': 0.015,
  openai: 0.015,
  // Gemini models (cheaper)
  vertexai: 0.003,
  // Default fallback
  default: 0.02,
};

interface CachedTestResult {
  passed: boolean;
  timestamp: number;
  cost?: number;
}

interface TestCache {
  version: number;
  results: Record<string, CachedTestResult>;
}

function loadCache(): TestCache | null {
  if (CLEAR_CACHE) {
    return null;
  }
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const data = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
      return JSON.parse(data) as TestCache;
    }
  } catch {
    // Ignore cache errors
  }
  return null;
}

function getCacheKey(modelKey: AIModelKey, tool: AITool): string {
  return `${modelKey}:${tool}`;
}

function getProviderPrefix(modelKey: AIModelKey): string {
  // Extract provider from model key (e.g., "vertexai-anthropic" from "vertexai-anthropic:claude-...")
  const parts = modelKey.split(':');
  return parts[0] || 'default';
}

function getFallbackCost(modelKey: AIModelKey): number {
  const prefix = getProviderPrefix(modelKey);
  return FALLBACK_COST_PER_TEST[prefix] ?? FALLBACK_COST_PER_TEST['default'];
}

function getEnabledModels(): AIModelKey[] {
  return (Object.entries(MODELS_CONFIGURATION) as [AIModelKey, (typeof MODELS_CONFIGURATION)[AIModelKey]][])
    .filter(([_, config]) => {
      return config.mode !== 'disabled' && config.canStreamWithToolCalls;
    })
    .map(([key]) => key);
}

function getTestableTools(): AITool[] {
  return (Object.entries(aiToolsSpec) as [AITool, (typeof aiToolsSpec)[AITool]][])
    .filter(([_, spec]) => {
      return spec.sources.includes('AIAnalyst');
    })
    .map(([tool]) => tool);
}

interface EstimateResult {
  totalTests: number;
  testsToRun: number;
  testsCached: number;
  testsNeverRun: number;
  estimatedCost: number;
  cachedCostSaved: number;
  byModel: Map<
    AIModelKey,
    {
      toRun: number;
      cached: number;
      neverRun: number;
      estimatedCost: number;
    }
  >;
}

function estimateCosts(): EstimateResult {
  const cache = loadCache();
  const enabledModels = getEnabledModels();
  const testableTools = getTestableTools();
  const testCases = toolCallTestCases.filter((tc) => testableTools.includes(tc.tool));

  let totalTests = 0;
  let testsToRun = 0;
  let testsCached = 0;
  let testsNeverRun = 0;
  let estimatedCost = 0;
  let cachedCostSaved = 0;

  const byModel = new Map<
    AIModelKey,
    {
      toRun: number;
      cached: number;
      neverRun: number;
      estimatedCost: number;
    }
  >();

  for (const modelKey of enabledModels) {
    let modelToRun = 0;
    let modelCached = 0;
    let modelNeverRun = 0;
    let modelEstimatedCost = 0;

    for (const testCase of testCases) {
      totalTests++;
      const key = getCacheKey(modelKey, testCase.tool);
      const cached = cache?.results[key];

      if (CLEAR_CACHE) {
        // Fresh run - everything runs
        modelToRun++;
        const cost = cached?.cost ?? getFallbackCost(modelKey);
        modelEstimatedCost += cost;
      } else if (cached === undefined) {
        // Not in cache - will be skipped (never run)
        modelNeverRun++;
        testsNeverRun++;
      } else if (cached.passed) {
        // Cached as passed - will be skipped
        modelCached++;
        testsCached++;
        cachedCostSaved += cached.cost ?? 0;
      } else {
        // Cached as failed - will run
        modelToRun++;
        const cost = cached.cost ?? getFallbackCost(modelKey);
        modelEstimatedCost += cost;
      }
    }

    testsToRun += modelToRun;
    estimatedCost += modelEstimatedCost;

    byModel.set(modelKey, {
      toRun: modelToRun,
      cached: modelCached,
      neverRun: modelNeverRun,
      estimatedCost: modelEstimatedCost,
    });
  }

  return {
    totalTests,
    testsToRun,
    testsCached,
    testsNeverRun,
    estimatedCost,
    cachedCostSaved,
    byModel,
  };
}

function main() {
  const result = estimateCosts();
  const enabledModels = getEnabledModels();
  const testableTools = getTestableTools();
  const testCases = toolCallTestCases.filter((tc) => testableTools.includes(tc.tool));

  console.log('\n' + '='.repeat(80));
  console.log('AI Tool Call Test - Cost Estimate');
  console.log('='.repeat(80) + '\n');

  console.log(`Mode: ${CLEAR_CACHE ? 'FRESH RUN (all tests)' : 'CACHED RUN (only failures/new tests)'}`);
  console.log(`Models: ${enabledModels.length}`);
  console.log(`Tool test cases: ${testCases.length}`);
  console.log(`Total possible tests: ${result.totalTests}\n`);

  if (!CLEAR_CACHE && result.testsCached > 0) {
    console.log('Cache status:');
    console.log(`  Passed (will skip): ${result.testsCached}`);
    console.log(`  Failed (will re-run): ${result.testsToRun}`);
    console.log(`  Never run (will skip): ${result.testsNeverRun}`);
    console.log(`  Cost saved by cache: $${result.cachedCostSaved.toFixed(4)}\n`);
  }

  console.log('Tests to run by model:');
  for (const [modelKey, stats] of result.byModel) {
    if (stats.toRun > 0) {
      console.log(`  ${modelKey}:`);
      console.log(`    Will run: ${stats.toRun} tests, Est. cost: $${stats.estimatedCost.toFixed(4)}`);
    } else if (CLEAR_CACHE) {
      console.log(`  ${modelKey}: ${testCases.length} tests, Est. cost: $${stats.estimatedCost.toFixed(4)}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`TESTS TO RUN: ${result.testsToRun}`);
  console.log(`ESTIMATED COST: $${result.estimatedCost.toFixed(4)}`);
  console.log('='.repeat(80));

  if (result.testsToRun === 0) {
    console.log('\n✅ No tests to run - all tests are cached as passed!');
    console.log(`   Use 'npm run test:ai-tools:fresh' to re-run all tests.`);
  }

  if (result.testsNeverRun > 0 && !CLEAR_CACHE) {
    console.log(`\n⚠️  ${result.testsNeverRun} tests have never been run.`);
    console.log(`   Use 'npm run test:ai-tools:fresh' to run them.`);
  }

  console.log(`\nSafeguards:`);
  console.log(`  - Max cost limit: $${MAX_COST_USD} (tests stop if exceeded)`);

  if (result.estimatedCost > MAX_COST_USD) {
    console.log(`\n⚠️  WARNING: Estimated cost ($${result.estimatedCost.toFixed(2)}) exceeds limit ($${MAX_COST_USD})`);
    console.log(`   Some tests may be skipped when the limit is reached.`);
  }

  console.log(`\nNote: Estimates use historical costs from cache when available.`);
  console.log(`For tests without cache data, provider-based fallback estimates are used.`);
  console.log('\n');
}

main();
