/**
 * This is an enhancement for non-prod environments where we set a different
 * favicon to help identity different tabs.
 */
export function setFavicon() {
  const hostname = window.location.hostname;

  // If it's prod, don't do anything
  if (hostname === 'app.quadratichq.com') {
    return;
  }

  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return;

  // Localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    link.href = '/favicon-local.ico';
  }

  // QA
  if (hostname.includes('qa.quadratic-preview.com')) {
    link.href = '/favicon-qa.ico';
  }

  // Previews
  if (hostname.includes('quadratic-preview.com')) {
    link.href = '/favicon-preview.ico';
  }

  // Don't do anything if you don't know what it is
}
