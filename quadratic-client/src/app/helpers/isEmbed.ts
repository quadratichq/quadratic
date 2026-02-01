function getEmbedSettings() {
  // Route-based detection (new /embed route)
  const isEmbedRoute = window.location.pathname.startsWith('/embed');

  // Query-param based detection (legacy, for backward compatibility)
  const searchParams = new URLSearchParams(window.location.search);
  const isEmbedParam = searchParams.get('embed') !== null;

  const isEmbed = isEmbedRoute || isEmbedParam;

  // For embed route, AI is always disabled
  // For embed param, it can be explicitly disabled via noAi param
  const isAiDisabled = isEmbedRoute || searchParams.get('noAi') !== null;

  // noMultiplayer is always true when embedded (route or param)
  // Can also be explicitly set via query param
  const isNoMultiplayer = searchParams.get('noMultiplayer') !== null || isEmbed;

  return { isEmbed, isAiDisabled, isNoMultiplayer };
}

const embedSettings = getEmbedSettings();

/**
 * This can be used in various places to determine whether the app
 * is currently in "embed" mode. Detected via:
 * - Route-based: /embed route (new)
 * - Query-param: ?embed on /file/:uuid (legacy, for backward compatibility)
 */
export const isEmbed = embedSettings.isEmbed;

/**
 * Whether AI features should be disabled.
 * - Always true for /embed route
 * - Controlled by `noAi` query param for legacy ?embed mode
 */
export const isAiDisabled = embedSettings.isAiDisabled;

/**
 * Whether multiplayer and offline transaction saving should be disabled.
 * When true, changes are local only and lost when refreshed.
 * Always true when embedded (via route or query param).
 */
export const isNoMultiplayer = embedSettings.isNoMultiplayer;
