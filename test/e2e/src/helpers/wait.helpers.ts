import type { Page } from '@playwright/test';
import { skipFeatureWalkthrough } from './auth.helpers';

/**
 * Centralized wait utilities for E2E tests.
 * Use these instead of arbitrary waitForTimeout calls for more reliable and faster tests.
 */

/**
 * Wait for Quadratic loading indicator to disappear.
 * This is the primary indicator that the app has finished loading.
 */
export const waitForQuadraticLoad = async (page: Page, timeout = 2 * 60 * 1000) => {
  await page.locator('html[data-loading-start]').waitFor({ state: 'hidden', timeout });
};

/**
 * Wait for the app to be fully loaded and ready for interaction.
 * Use this after navigation or page reload.
 */
export const waitForAppReady = async (page: Page) => {
  await page.waitForLoadState('domcontentloaded');
  await waitForQuadraticLoad(page);
  await page.waitForLoadState('networkidle').catch(() => {});
};

/**
 * Wait for the canvas to be visible and ready for interaction.
 * Use this when entering a spreadsheet file.
 */
export const waitForCanvasReady = async (page: Page, timeout = 2 * 60 * 1000) => {
  await waitForAppReady(page);
  await page.locator('#QuadraticCanvasID').waitFor({ state: 'visible', timeout });
  // Skip the feature walkthrough tour if it appears
  await skipFeatureWalkthrough(page);
};

/**
 * Wait for network activity to settle.
 * Use this after actions that trigger API calls.
 */
export const waitForNetworkIdle = async (page: Page, timeout = 10 * 1000) => {
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {});
};

/**
 * Short wait for UI animations to complete.
 * Only use when absolutely necessary (e.g., waiting for CSS transitions).
 */
export const waitForAnimation = async (page: Page, duration = 500) => {
  await page.waitForTimeout(duration);
};

/**
 * Wait for a specific element to be stable (not moving/changing).
 * Useful before taking screenshots.
 */
export const waitForElementStable = async (page: Page, selector: string, timeout = 5 * 1000) => {
  const element = page.locator(selector);
  await element.waitFor({ state: 'visible', timeout });
  // Wait for any animations to complete
  await page.waitForTimeout(500);
};
