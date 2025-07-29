import { authClient } from '@/auth/auth';
import { redirect, type LoaderFunctionArgs } from 'react-router';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const state = url.searchParams.get('state');

  let redirectTo = '/';
  try {
    if (state) {
      const stateObj = JSON.parse(decodeURIComponent(state));
      if (
        !!stateObj &&
        typeof stateObj === 'object' &&
        'redirectTo' in stateObj &&
        !!stateObj.redirectTo &&
        typeof stateObj.redirectTo === 'string'
      ) {
        redirectTo = stateObj.redirectTo;
      }
    }
  } catch {}

  await authClient.handleSigninRedirect();

  return redirect(redirectTo);
};
