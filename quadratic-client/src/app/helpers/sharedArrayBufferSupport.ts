/**
 * Detect SharedArrayBuffer availability.
 *
 * SharedArrayBuffer requires cross-origin isolation headers:
 * - Cross-Origin-Opener-Policy: same-origin
 * - Cross-Origin-Embedder-Policy: require-corp
 *
 * When embedding Quadratic in an iframe, the parent page may not set these
 * headers, making SharedArrayBuffer unavailable. This module provides
 * detection so we can fall back to async alternatives.
 */

/**
 * Check if we're running in the main thread (has window/document).
 * Web workers don't have window or document.
 */
const isMainThread = typeof window !== 'undefined' && typeof document !== 'undefined';

/**
 * Check embed mode from route and query params.
 * Only works reliably in the main thread - workers have their own location
 * that points to the worker script URL, not the page URL.
 * This duplicates the logic from isEmbed.ts to avoid importing it in workers.
 */
function checkEmbedMode(): boolean {
  if (!isMainThread) {
    return false;
  }

  try {
    // Route-based detection (new /embed route)
    const isEmbedRoute = window.location.pathname.startsWith('/embed');
    // Query-param based detection (legacy, for backward compatibility)
    const searchParams = new URLSearchParams(window.location.search);
    const isEmbedParam = searchParams.get('embed') !== null;
    return isEmbedRoute || isEmbedParam;
  } catch {
    return false;
  }
}

/**
 * Check for explicit SAB disable via URL parameters.
 * Only works reliably in the main thread - workers have their own location
 * that points to the worker script URL, not the page URL.
 */
function checkUrlParams(): { forceNoSAB: boolean } {
  // Only check URL params in main thread where window.location is available
  // Workers will receive embed mode via init message
  if (!isMainThread) {
    return { forceNoSAB: false };
  }

  try {
    const searchParams = new URLSearchParams(window.location.search);
    return {
      forceNoSAB: searchParams.get('noSAB') !== null,
    };
  } catch {
    return { forceNoSAB: false };
  }
}

const urlParams = checkUrlParams();

// Mutable state for embed mode - can be updated by workers after init
// In main thread, check embed mode directly (checks both route and query param)
// In workers, this will be set via configureSABSupport()
let _isEmbed = isMainThread ? checkEmbedMode() : false;
let _forceNoSAB = urlParams.forceNoSAB;

/**
 * Configure SAB support settings. Called by workers after receiving
 * embed mode info from the main thread.
 */
export function configureSABSupport(options: { isEmbed?: boolean; forceNoSAB?: boolean }) {
  if (options.isEmbed !== undefined) {
    _isEmbed = options.isEmbed;
  }
  if (options.forceNoSAB !== undefined) {
    _forceNoSAB = options.forceNoSAB;
  }
}

/**
 * Whether SharedArrayBuffer is available in this context.
 * This will be false when:
 * - The page is not cross-origin isolated
 * - The browser doesn't support SharedArrayBuffer
 * - Embedding in an iframe without proper headers
 * - URL has `/embed` route or `?embed` parameter (embed mode)
 * - URL has `?noSAB` parameter (explicit disable for testing)
 * - configureSABSupport was called with isEmbed: true
 */
export function getHasSharedArrayBuffer(): boolean {
  // In main thread, always check embed mode dynamically (checks route + query param)
  // In workers, use the configured value
  const currentIsEmbed = isMainThread ? checkEmbedMode() : _isEmbed;
  return !currentIsEmbed && !_forceNoSAB && typeof SharedArrayBuffer !== 'undefined';
}

/**
 * Whether the page is cross-origin isolated.
 * This is a more specific check that indicates the required headers are set.
 */
export const isCrossOriginIsolated = typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated;

/**
 * Whether running in embed mode (derived from route, URL parameter, or configuration).
 * In main thread: checks both `/embed` route and `?embed` query param.
 * In workers: uses value passed via configureSABSupport().
 */
export function getIsEmbedMode(): boolean {
  // In main thread, always check embed mode dynamically (checks route + query param)
  // In workers, use the configured value
  if (isMainThread) {
    return checkEmbedMode();
  }
  return _isEmbed;
}

// For backwards compatibility
export const isEmbedMode = _isEmbed;
