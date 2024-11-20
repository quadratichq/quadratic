export function getJavascriptFetchOverride(proxyUrl: string, jwt: string) {
  return `
self['fetch'] = new Proxy(fetch, {
  apply: function (target, thisArg, args) {
    const [url, config] = args;

    const newConfig = config || {};
    const headers = newConfig.headers || {};
    const newHeaders = {};

    // Prefix all original request headers with X-Proxy-
    for (const key in headers) {
      newHeaders[\`X-Proxy-\${key}\`] = headers[key];
    }

    // Set the original request URL on X-Proxy-Url header
    newHeaders['X-Proxy-Url'] = url.toString();

    // Set the authorization header for the proxy server
    newHeaders['Authorization'] = 'Bearer ${jwt}';

    newConfig.headers = newHeaders;

    return target.call(thisArg, '${proxyUrl}', newConfig);
  },
});\n
`;
}
