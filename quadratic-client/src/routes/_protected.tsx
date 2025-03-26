import { authClient } from '@/auth/auth';
import { ROUTES } from '@/shared/constants/routes';
import { redirect, type LoaderFunctionArgs } from 'react-router';

export const clientLoader = async (loaderFnArgs: LoaderFunctionArgs) => {
  const { request } = loaderFnArgs;
  const isAuthenticated = await authClient.isAuthenticated();

  // If the user isn't authenticated, redirect them to login & preserve their
  // original request URL
  if (!isAuthenticated) {
    const originalRequestUrl = new URL(request.url);
    let searchParams = new URLSearchParams();
    searchParams.set('from', originalRequestUrl.pathname + originalRequestUrl.search);
    return redirect(ROUTES.LOGIN + '?' + searchParams.toString());
  }

  // If the user is authenticated, make sure we have a valid token
  // before we load any of the app
  await authClient.getTokenOrRedirect();

  return null;
};
