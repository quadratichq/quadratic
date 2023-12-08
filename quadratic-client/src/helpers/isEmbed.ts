/**
 * This fn can be used in various places to determine whether the app
 * is currently in "embed" mode (which is derived from a URL search param)
 */
function getIsEmbed() {
  const searchParams = new URLSearchParams(window.location.search);
  const isEmbed = searchParams.get('embed') !== null;
  return isEmbed;
}

export const isEmbed = getIsEmbed();
