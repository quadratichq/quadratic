#!/usr/bin/env tsx
/**
 * Script to run Playwright tests, skipping tests that passed in previous runs.
 * This is useful when tests fail due to parallel execution issues.
 *
 * This script:
 * 1. Reads the JSON report to find tests that passed in the last run
 * 2. Maintains a cumulative cache of all tests that have ever passed
 * 3. Skips all tests in the cache (including tests skipped due to prior passes)
 * 4. Runs all other tests (failed, interrupted, or new)
 *
 * The cache persists across runs, so tests that passed once will continue
 * to be skipped in subsequent runs until manually cleared.
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

const PLAYWRIGHT_REPORT_DIR = join(process.cwd(), 'playwright-report');
const PASSED_TESTS_CACHE = join(PLAYWRIGHT_REPORT_DIR, '.passed-tests-cache.json');

function getAllTests(): string[] {
  try {
    const output = execSync('npx playwright test --list', { encoding: 'utf-8' });
    const lines = output.split('\n');
    const tests: string[] = [];

    for (const line of lines) {
      // Playwright list output format: "  -   1 [chromium] › src/file.spec.ts:10:5 › Test Name"
      // We need to extract just the test name (the part after the last ›)
      const parts = line.split('›');
      if (parts.length >= 2) {
        const testName = parts[parts.length - 1].trim();
        if (testName) {
          tests.push(testName);
        }
      }
    }

    return tests;
  } catch (error) {
    console.warn('Error getting test list:', error);
    return [];
  }
}

async function getPassedTestsFromReport(): Promise<string[]> {
  // Try multiple methods to get passed tests
  // Method 1: Parse HTML report for passed test indicators
  const fromHTML = getPassedTestsFromHTML();
  if (fromHTML.length > 0) {
    return fromHTML;
  }

  // Method 2: Use Playwright's --list with status filtering
  // We can't directly filter by status, so we'll use a different approach
  return await getPassedTestsFromTestResults();
}

function getPassedTestsFromHTML(): string[] {
  // HTML parsing is complex due to base64 encoding
  // Return empty to fall back to test-results method
  return [];
}

async function getPassedTestsFromTestResults(): Promise<string[]> {
  try {
    // Load previously cached passed tests (cumulative across runs)
    const cachedPassedTests = loadCachedPassedTests();

    // Use Playwright's JSON reporter to get accurate test results
    const jsonReportPath = join(PLAYWRIGHT_REPORT_DIR, 'report.json');

    if (existsSync(jsonReportPath)) {
      const { passed, skipped } = getPassedTestsFromJSONReport(jsonReportPath);

      // Combine: tests that passed in this run + tests that were skipped (likely excluded)
      // + tests that passed in previous runs
      const allPassedTests = new Set(cachedPassedTests);

      // Add newly passed tests
      for (const test of passed) {
        allPassedTests.add(test);
      }

      // Add skipped tests (these were likely excluded because they passed earlier)
      // Only add them if they're in our cache (meaning they passed in a previous run)
      // This distinguishes between "skipped because passed" vs "skipped for other reasons"
      for (const test of skipped) {
        // If test was in cache (passed before), keep it skipped
        // If test is new and skipped, it might be skipped for other reasons, so don't add it
        if (cachedPassedTests.has(test)) {
          allPassedTests.add(test);
        }
      }

      // Save updated cache for next run
      saveCachedPassedTests(allPassedTests);

      return Array.from(allPassedTests);
    }

    // No JSON report found - use cached tests if available
    if (cachedPassedTests.size > 0) {
      console.log(`Using cached passed tests from previous runs (${cachedPassedTests.size} tests)`);
      return Array.from(cachedPassedTests);
    }

    console.log('No JSON report found. Cannot accurately determine passed tests.');
    console.log('Tip: Run tests with --reporter=json to enable this feature.');
    return [];
  } catch (error) {
    console.warn(`Error getting test results: ${error}`);
    // Return cached tests as fallback
    const cached = loadCachedPassedTests();
    return Array.from(cached);
  }
}

function getPassedTestsFromJSONReport(jsonReportPath: string): {
  passed: string[];
  skipped: string[];
} {
  try {
    const reportContent = readFileSync(jsonReportPath, 'utf-8');
    const report = JSON.parse(reportContent);
    const passedTests: string[] = [];
    const skippedTests: string[] = [];

    // Parse Playwright JSON report structure
    // Report has a "files" array, each with "specs" array, each with "tests" array
    if (report.files && Array.isArray(report.files)) {
      for (const file of report.files) {
        if (file.specs && Array.isArray(file.specs)) {
          for (const spec of file.specs) {
            if (spec.tests && Array.isArray(spec.tests)) {
              for (const test of spec.tests) {
                // Check the last result to see test status
                if (test.results && test.results.length > 0) {
                  const lastResult = test.results[test.results.length - 1];
                  if (lastResult.status === 'passed') {
                    passedTests.push(test.title);
                  } else if (lastResult.status === 'skipped') {
                    // Tests that were skipped (likely because we excluded them)
                    skippedTests.push(test.title);
                  }
                }
              }
            }
          }
        }
      }
    }

    return { passed: passedTests, skipped: skippedTests };
  } catch (error) {
    console.warn(`Error parsing JSON report: ${error}`);
    return { passed: [], skipped: [] };
  }
}

function loadCachedPassedTests(): Set<string> {
  if (!existsSync(PASSED_TESTS_CACHE)) {
    return new Set();
  }

  try {
    const cacheContent = readFileSync(PASSED_TESTS_CACHE, 'utf-8');
    const cachedTests = JSON.parse(cacheContent);
    return new Set(cachedTests);
  } catch (error) {
    console.warn(`Error reading passed tests cache: ${error}`);
    return new Set();
  }
}

function saveCachedPassedTests(tests: Set<string>): void {
  try {
    const testsArray = Array.from(tests);
    const cacheContent = JSON.stringify(testsArray, null, 2);
    // Ensure directory exists
    try {
      mkdirSync(PLAYWRIGHT_REPORT_DIR, { recursive: true });
    } catch {
      // Directory might already exist
    }
    writeFileSync(PASSED_TESTS_CACHE, cacheContent, 'utf-8');
  } catch (error) {
    console.warn(`Error saving passed tests cache: ${error}`);
  }
}

function buildGrepInvertPattern(passedTests: string[]): string {
  if (passedTests.length === 0) {
    return '';
  }

  // Escape special regex characters in test titles
  const escapedTests = passedTests.map((title) => title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  // Create a regex pattern that matches any of the passed tests
  // Use negative lookahead or simple alternation
  return `(${escapedTests.join('|')})`;
}

function clearCache(): void {
  if (existsSync(PASSED_TESTS_CACHE)) {
    try {
      unlinkSync(PASSED_TESTS_CACHE);
      console.log('✓ Cleared passed tests cache.');
    } catch (error) {
      console.error(`Error clearing cache: ${error}`);
      process.exit(1);
    }
  } else {
    console.log('No cache file found. Nothing to clear.');
  }
}

async function main() {
  // Check for --clear-cache flag
  const args = process.argv.slice(2);
  if (args.includes('--clear-cache') || args.includes('-c')) {
    clearCache();
    return;
  }

  const allTests = getAllTests();
  const passedTests = await getPassedTestsFromReport();

  if (allTests.length === 0) {
    console.log('No tests found.');
    return;
  }

  // If no passed tests found, run all tests
  if (passedTests.length === 0) {
    console.log('No passed tests found in last run. Running all tests.');
    execSync('npx playwright test', { stdio: 'inherit' });
    return;
  }

  // If all tests passed, we're done
  if (passedTests.length >= allTests.length) {
    console.log('All tests passed in last run. Nothing to run.');
    return;
  }

  const testsToRun = allTests.length - passedTests.length;

  console.log(`Found ${allTests.length} total tests.`);
  console.log(`  - ${passedTests.length} tests to skip (passed in previous runs)`);
  console.log(`  - ${testsToRun} tests to run (failed, interrupted, or new)`);
  console.log(`\nSkipping ${passedTests.length} tests that passed in previous runs. Running remaining tests...\n`);

  const grepPattern = buildGrepInvertPattern(passedTests);

  try {
    // Use --grep-invert to exclude passed tests
    // This will run: failed tests, interrupted tests, skipped tests, and any new tests
    execSync(`npx playwright test --grep-invert "${grepPattern}"`, { stdio: 'inherit' });
  } catch {
    // If grep pattern fails, fall back to running all tests
    console.warn('Error with grep pattern, running all tests instead.');
    execSync('npx playwright test', { stdio: 'inherit' });
  }
}

main();
