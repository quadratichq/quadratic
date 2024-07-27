import { redirect } from 'react-router-dom';
import type { LoaderFunctionArgs } from 'react-router-dom';

import { authClient } from '@/auth';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const isAuthenticated = await authClient.isAuthenticated();

  // If they’re logged in, redirect home
  if (isAuthenticated) {
    return redirect('/');
  }

  // If not, send them to Auth0
  // Watch for a `from` query param, as unprotected routes will redirect
  // to here for them to auth first
  // Also watch for the presence of a `signup` query param, which means
  // send the user to sign up flow, not login
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get('from') || '/';
  const isSignupFlow = url.searchParams.get('signup') !== null;
  await authClient.login(redirectTo, isSignupFlow);

  // auth0 will re-route us (above) but telling react-router where we
  // are re-routing to makes sure that this doesn't end up in the history stack
  return redirect(redirectTo);
};
