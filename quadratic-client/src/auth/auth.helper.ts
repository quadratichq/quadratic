/**
 * In cases where we call the auth client and it redirects the user to the
 * auth website (e.g. for `.login` and `.logout`, presumably via changing
 * `window.location`) we have to manually wait for the auth client.
 *
 * Why? Because even though auth's client APIs are async, they seem to
 * complete immediately and our app's code continues before `window.location`
 * kicks in.
 *
 * So this function ensures our whole app pauses while the auth lib does its
 * thing and kicks the user over to auth.com
 *
 * We only use this when we _want_ to pause everything and wait to redirect
 */
export function waitForAuthClientToRedirect() {
  return new Promise((resolve) => setTimeout(resolve, 30 * 1000));
}

/**
 * Utility function parse the domain from a url
 */
export function parseDomain(url: string): string {
  // remove the port if present
  const [hostname] = url.split(':');

  // check if the hostname is an IP address
  const isIpAddress = /^[\d.]+$/.test(hostname);

  if (isIpAddress) return hostname;

  const parts = hostname.split('.');

  // remove subdomain
  if (parts.length > 2) {
    return parts.slice(-2).join('.');
  }

  return hostname;
}
