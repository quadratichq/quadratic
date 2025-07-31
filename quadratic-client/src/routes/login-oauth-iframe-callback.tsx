import { type LoaderFunctionArgs } from 'react-router';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const oauthKey = url.searchParams.get('oauthKey');
  if (oauthKey) {
    localStorage.setItem(oauthKey, 'complete');
  }
  window.close();
};
