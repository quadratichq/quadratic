#!/usr/bin/env tsx
/**
 * Script to run Playwright tests, skipping tests that passed in previous runs.
 * This is useful when tests fail due to parallel execution issues.
 *
 * This script:
 * 1. Parses stdout in real-time to detect passed tests as they run
 * 2. Maintains a cumulative cache of all tests that have ever passed
 * 3. Skips all tests in the cache
 * 4. Runs all other tests (failed, interrupted, or new)
 *
 * The cache persists across runs, so tests that passed once will continue
 * to be skipped in subsequent runs until manually cleared.
 */

import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

// Store cache outside playwright-report since Playwright clears that directory on each run
const PASSED_TESTS_CACHE = join(process.cwd(), '.passed-tests-cache.json');

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
    writeFileSync(PASSED_TESTS_CACHE, cacheContent, 'utf-8');
  } catch (error) {
    console.warn(`Error saving passed tests cache: ${error}`);
  }
}

function runTestsAndCaptureResults(command: string): Promise<number> {
  return new Promise((resolve) => {
    const cachedPassedTests = loadCachedPassedTests();
    const initialCacheSize = cachedPassedTests.size;

    // Parse command into parts for spawn
    const parts = command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);

    const child = spawn(cmd, args, {
      shell: true,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    // Regex to match passed test lines in Playwright output
    // Format: "  ✓   10 [chromium] › src/auth.spec.ts:21:1 › Test Name (1.2m)"
    // or: "  ✓  1 src/file.spec.ts:10:5 › Test Name (1s)"
    const passedPattern = /^\s*✓\s+\d+\s+(?:\[.*?\]\s+›\s+)?.*?›\s+(.+?)(?:\s+\([\d.]+[ms]+\))?$/;

    let buffer = '';

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      process.stdout.write(text);

      // Buffer incomplete lines
      buffer += text;
      const lines = buffer.split('\n');
      // Keep the last incomplete line in buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        const match = line.match(passedPattern);
        if (match) {
          const testName = match[1].trim();
          if (testName && !cachedPassedTests.has(testName)) {
            cachedPassedTests.add(testName);
            // Save immediately so it persists even if interrupted
            saveCachedPassedTests(cachedPassedTests);
          }
        }
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      process.stderr.write(data);
    });

    child.on('close', (code) => {
      // Process any remaining buffered content
      if (buffer) {
        const match = buffer.match(passedPattern);
        if (match) {
          const testName = match[1].trim();
          if (testName && !cachedPassedTests.has(testName)) {
            cachedPassedTests.add(testName);
            saveCachedPassedTests(cachedPassedTests);
          }
        }
      }

      const newTestsCount = cachedPassedTests.size - initialCacheSize;
      if (newTestsCount > 0) {
        console.log(`\n✓ Saved ${newTestsCount} newly passed tests to cache (total: ${cachedPassedTests.size}).`);
      }

      resolve(code || 0);
    });

    // Handle SIGINT (Ctrl+C) gracefully
    process.on('SIGINT', () => {
      const newTestsCount = cachedPassedTests.size - initialCacheSize;
      if (newTestsCount > 0) {
        console.log(`\n✓ Saved ${newTestsCount} newly passed tests to cache before exit.`);
      }
      child.kill('SIGINT');
    });
  });
}

function buildGrepInvertPattern(passedTests: string[]): string {
  if (passedTests.length === 0) {
    return '';
  }

  // Escape special regex characters in test titles
  const escapedTests = passedTests.map((title) => title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  // Create a regex pattern that matches any of the passed tests
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
  const passedTests = loadCachedPassedTests();

  if (allTests.length === 0) {
    console.log('No tests found.');
    return;
  }

  // If no passed tests found, run all tests (with bail flag)
  if (passedTests.size === 0) {
    console.log('No passed tests in cache. Running all tests.');
    const exitCode = await runTestsAndCaptureResults('npx playwright test -x');
    process.exit(exitCode);
  }

  // If all tests passed, we're done
  if (passedTests.size >= allTests.length) {
    console.log('All tests passed in previous runs. Nothing to run.');
    console.log('Use --clear-cache to reset and run all tests again.');
    return;
  }

  const testsToRun = allTests.length - passedTests.size;

  console.log(`Found ${allTests.length} total tests.`);
  console.log(`  - ${passedTests.size} tests to skip (passed in previous runs)`);
  console.log(`  - ${testsToRun} tests to run (failed, interrupted, or new)`);
  console.log(`\nSkipping ${passedTests.size} tests that passed. Running remaining tests...\n`);

  const grepPattern = buildGrepInvertPattern(Array.from(passedTests));

  // Use --grep-invert to exclude passed tests, and -x to stop on first failure
  const exitCode = await runTestsAndCaptureResults(`npx playwright test --grep-invert "${grepPattern}" -x`);
  process.exit(exitCode);
}

main();
