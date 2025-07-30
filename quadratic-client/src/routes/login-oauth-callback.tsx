import { type LoaderFunctionArgs } from 'react-router';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (code && state) {
    window.opener.postMessage(
      {
        type: 'OAUTH_SUCCESS',
        code,
        state,
      },
      window.location.origin
    );
  } else {
    window.opener.postMessage(
      {
        type: 'OAUTH_ERROR',
        error: 'No code or state found.',
      },
      window.location.origin
    );
  }
};

export const Component = () => {
  return <div>{'Logging in...'}</div>;
};
