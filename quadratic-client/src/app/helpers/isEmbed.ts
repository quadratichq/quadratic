function getEmbedSettings() {
  const searchParams = new URLSearchParams(window.location.search);
  const isEmbed = searchParams.get('embed') !== null;
  const isAiDisabled = searchParams.get('noAi') !== null;
  // noMultiplayer can be explicitly set via query param, or defaults to true when embed is true
  // This disables multiplayer connection and offline transaction saving
  const isNoMultiplayer = searchParams.get('noMultiplayer') !== null || isEmbed;
  return { isEmbed, isAiDisabled, isNoMultiplayer };
}

const embedSettings = getEmbedSettings();

/**
 * This can be used in various places to determine whether the app
 * is currently in "embed" mode (which is derived from a URL search param)
 */
export const isEmbed = embedSettings.isEmbed;

/**
 * Whether AI features should be disabled in embed mode.
 * Controlled by the `noAi` URL search param (e.g., `?embed&noAi`)
 */
export const isAiDisabled = embedSettings.isAiDisabled;

/**
 * Whether multiplayer and offline transaction saving should be disabled.
 * When true, changes are local only and lost when refreshed.
 * Currently automatically enabled when embed mode is active.
 */
export const isNoMultiplayer = embedSettings.isNoMultiplayer;
