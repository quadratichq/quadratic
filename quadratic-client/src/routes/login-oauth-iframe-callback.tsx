import { type LoaderFunctionArgs } from 'react-router';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const oauthKey = url.searchParams.get('oauthKey');
  if (oauthKey) {
    const channel = new BroadcastChannel('oauth-callback-channel');
    channel.postMessage({
      type: 'login-oauth-iframe-callback',
      oauthKey: oauthKey,
    });
    channel.close();
  }
  window.close();
};
