import { authClient } from '@/auth/auth';
import { VITE_AUTH_TYPE } from '@/env-vars';
import { LoginForm } from '@/shared/components/auth/LoginForm';
import { SEARCH_PARAMS } from '@/shared/constants/routes';
import { getRedirectTo } from '@/shared/utils/getRedirectToOrLoginResult';
import type { LoaderFunctionArgs } from 'react-router';

// note: this is not used by WorkOS since it uses the WorkOS login flow

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const redirectTo = getRedirectTo() || '/';

  const isAuthenticated = await authClient.isAuthenticated();
  if (isAuthenticated) {
    window.location.assign(redirectTo);
  } else {
    if (VITE_AUTH_TYPE === 'workos') {
      await authClient.login({ redirectTo, href: request.url });
      return;
    }
    const url = new URL(request.url);
    const loginType = url.searchParams.get(SEARCH_PARAMS.LOGIN_TYPE.KEY)?.toLowerCase() ?? '';
    const isSignupFlow = loginType === SEARCH_PARAMS.LOGIN_TYPE.VALUES.SIGNUP;
    if (isSignupFlow) {
      await authClient.login({ redirectTo, isSignupFlow: true, href: request.url });
    }
  }
};

export const Component = () => {
  if (VITE_AUTH_TYPE === 'workos') {
    return null;
  }
  return <LoginForm />;
};
