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
 * Check for embed mode or explicit SAB disable via URL parameters.
 * Only works reliably in the main thread - workers have their own location
 * that points to the worker script URL, not the page URL.
 */
function checkUrlParams(): { isEmbed: boolean; forceNoSAB: boolean } {
  // Only check URL params in main thread where window.location is available
  // Workers will receive embed mode via init message
  if (!isMainThread) {
    return { isEmbed: false, forceNoSAB: false };
  }

  try {
    const searchParams = new URLSearchParams(window.location.search);
    return {
      isEmbed: searchParams.get('embed') !== null,
      forceNoSAB: searchParams.get('noSAB') !== null,
    };
  } catch {
    return { isEmbed: false, forceNoSAB: false };
  }
}

const urlParams = checkUrlParams();

// Mutable state for embed mode - can be updated by workers after init
let _isEmbed = urlParams.isEmbed;
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
 * - URL has `?embed` parameter (embed mode)
 * - URL has `?noSAB` parameter (explicit disable for testing)
 * - configureSABSupport was called with isEmbed: true
 */
export function getHasSharedArrayBuffer(): boolean {
  return !_isEmbed && !_forceNoSAB && typeof SharedArrayBuffer !== 'undefined';
}

// For backwards compatibility - initial value
// Note: Workers should use getHasSharedArrayBuffer() after calling configureSABSupport
export const hasSharedArrayBuffer = getHasSharedArrayBuffer();

/**
 * Whether the page is cross-origin isolated.
 * This is a more specific check that indicates the required headers are set.
 */
export const isCrossOriginIsolated = typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated;

/**
 * Whether running in embed mode (derived from URL parameter or configuration)
 */
export function getIsEmbedMode(): boolean {
  return _isEmbed;
}

// For backwards compatibility
export const isEmbedMode = _isEmbed;
