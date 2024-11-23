export function getJavascriptXHROverride(proxyUrl: string, jwt: string) {
  return `
self['XMLHttpRequest'] = new Proxy(XMLHttpRequest, {
  construct: function (target, args) {
    const xhr = new target();

    xhr.open = new Proxy(xhr.open, {
      apply: function (target, thisArg, args) {
        Object.defineProperty(xhr, '__url', { value: args[1].toString(), writable: true });
        args[1] = '${proxyUrl}';
        return target.apply(thisArg, args);
      },
    });

    xhr.setRequestHeader = new Proxy(xhr.setRequestHeader, {
      apply: function (target, thisArg, args) {
        // apply quadratic-authorization header as the only authorization header
        // this is required for authentication with the proxy server
        if (args[0] === 'Quadratic-Authorization') {
          args[0] = 'Authorization';
        } else {
          // apply all headers on the original request prefixed with X-Proxy-
          args[0] = \`X-Proxy-\${args[0]}\`;
        }
        return target.apply(thisArg, args);
      },
    });

    xhr.onreadystatechange = function () {
      if (xhr.readyState === XMLHttpRequest.OPENED) {
        // this applies the quadratic-authorization header as the only authorization header
        // this is required for authentication with the proxy server
        xhr.setRequestHeader('Quadratic-Authorization', 'Bearer ${jwt}');

        // this applies the original request URL as the x-proxy-url header
        // this will get prefixed with X-Proxy due to above setRequestHeader override
        xhr.setRequestHeader('Url', xhr.__url);
      }
      // After completion of XHR request
      if (xhr.readyState === 4) {
        if (xhr.status === 401) {
        }
      }
    };

    return xhr;
  },
});\n
`;
}
