import { authClient } from '@/auth/auth';
import { SEARCH_PARAMS } from '@/shared/constants/routes';
import { getRedirectTo } from '@/shared/utils/getRedirectToOrLoginResult';
import type { LoaderFunctionArgs } from 'react-router';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const redirectTo = getRedirectTo(request.url) || '/';
  const isAuthenticated = await authClient.isAuthenticated();

  if (isAuthenticated) {
    window.location.href = redirectTo;
    return null;
  } else {
    const loginType = url.searchParams.get(SEARCH_PARAMS.LOGIN_TYPE.KEY)?.toLowerCase() ?? '';
    const isSignupFlow = loginType === SEARCH_PARAMS.LOGIN_TYPE.VALUES.SIGNUP;
    await authClient.login({ redirectTo, isSignupFlow, href: request.url });
  }
};
