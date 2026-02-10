/**
 * Checks if a URL starts with http:// or https://
 */
export function hasHttpProtocol(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/**
 * Ensures a URL has an http/https protocol, adding https:// if missing
 */
export function ensureHttpProtocol(url: string): string {
  return hasHttpProtocol(url) ? url : `https://${url}`;
}

function getUrlToOpen(link: string): string {
  if (hasHttpProtocol(link)) {
    return link;
  } else if (link.startsWith('/')) {
    // URL starts with /, it is a relative path
    return link;
  } else {
    return `https://${link}`;
  }
}

export function openLink(url: string) {
  window.open(getUrlToOpen(url), '_blank', 'noopener,noreferrer');
}
