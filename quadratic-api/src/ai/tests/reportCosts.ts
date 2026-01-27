/**
 * Standalone script to report AI tool call test costs from cache
 *
 * Run with: npm run test:ai-tools:report
 *
 * This reports actual costs from previous test runs stored in the cache.
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

interface CostReport {
  totalTests: number;
  testsPassed: number;
  testsFailed: number;
  testsNeverRun: number;
  totalCost: number;
  byModel: Map<
    AIModelKey,
    {
      passed: number;
      failed: number;
      neverRun: number;
      cost: number;
    }
  >;
}

function reportCosts(): CostReport {
  const cache = loadCache();
  const enabledModels = getEnabledModels();
  const testableTools = getTestableTools();
  const testCases = toolCallTestCases.filter((tc) => testableTools.includes(tc.tool));

  let totalTests = 0;
  let testsPassed = 0;
  let testsFailed = 0;
  let testsNeverRun = 0;
  let totalCost = 0;

  const byModel = new Map<
    AIModelKey,
    {
      passed: number;
      failed: number;
      neverRun: number;
      cost: number;
    }
  >();

  for (const modelKey of enabledModels) {
    let modelPassed = 0;
    let modelFailed = 0;
    let modelNeverRun = 0;
    let modelCost = 0;

    for (const testCase of testCases) {
      totalTests++;
      const key = getCacheKey(modelKey, testCase.tool);
      const cached = cache?.results[key];

      if (cached === undefined) {
        modelNeverRun++;
        testsNeverRun++;
      } else if (cached.passed) {
        modelPassed++;
        testsPassed++;
        modelCost += cached.cost ?? 0;
      } else {
        modelFailed++;
        testsFailed++;
        modelCost += cached.cost ?? 0;
      }
    }

    totalCost += modelCost;

    byModel.set(modelKey, {
      passed: modelPassed,
      failed: modelFailed,
      neverRun: modelNeverRun,
      cost: modelCost,
    });
  }

  return {
    totalTests,
    testsPassed,
    testsFailed,
    testsNeverRun,
    totalCost,
    byModel,
  };
}

function main() {
  const report = reportCosts();
  const enabledModels = getEnabledModels();
  const testableTools = getTestableTools();
  const testCases = toolCallTestCases.filter((tc) => testableTools.includes(tc.tool));

  console.log('\n' + '='.repeat(80));
  console.log('AI Tool Call Test - Cost Report');
  console.log('='.repeat(80) + '\n');

  console.log(`Models: ${enabledModels.length}`);
  console.log(`Tool test cases: ${testCases.length}`);
  console.log(`Total possible tests: ${report.totalTests}\n`);

  console.log('Cache status:');
  console.log(`  Passed: ${report.testsPassed}`);
  console.log(`  Failed: ${report.testsFailed}`);
  console.log(`  Never run: ${report.testsNeverRun}\n`);

  console.log('Costs by model:');
  for (const [modelKey, stats] of report.byModel) {
    const testsRun = stats.passed + stats.failed;
    if (testsRun > 0) {
      console.log(`  ${modelKey}:`);
      console.log(`    Tests: ${testsRun} (${stats.passed} passed, ${stats.failed} failed), Cost: $${stats.cost.toFixed(4)}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`TOTAL COST FROM CACHE: $${report.totalCost.toFixed(4)}`);
  console.log(`MAX COST LIMIT: $${MAX_COST_USD}`);
  console.log('='.repeat(80));

  if (report.testsNeverRun > 0) {
    console.log(`\n⚠️  ${report.testsNeverRun} tests have never been run.`);
    console.log(`   Use 'npm run test:ai-tools:fresh' to run them.`);
  }

  if (report.testsFailed > 0) {
    console.log(`\n⚠️  ${report.testsFailed} tests failed and will re-run.`);
  }

  console.log('\n');
}

main();
