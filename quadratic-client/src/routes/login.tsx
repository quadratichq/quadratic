import { authClient } from '@/auth/auth';
import { waitForAuthClientToRedirect } from '@/auth/auth.helper';
import { apiClient } from '@/shared/api/apiClient';
import { LoginForm } from '@/shared/components/auth/LoginForm';
import { SEARCH_PARAMS } from '@/shared/constants/routes';
import { getRedirectTo } from '@/shared/utils/getRedirectToOrLoginResult';
import type { LoaderFunctionArgs } from 'react-router';

const isWorkOs = import.meta.env.VITE_AUTH_TYPE === 'workos';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const redirectTo = getRedirectTo() || '/';

  if (isWorkOs) {
    const { url } = await apiClient.workos.login(redirectTo);
    window.location.assign(url);
  }

  const isAuthenticated = await authClient.isAuthenticated();
  if (isAuthenticated) {
    window.location.assign(redirectTo);
    await waitForAuthClientToRedirect();
  } else {
    const url = new URL(request.url);
    const loginType = url.searchParams.get(SEARCH_PARAMS.LOGIN_TYPE.KEY)?.toLowerCase() ?? '';
    const isSignupFlow = loginType === SEARCH_PARAMS.LOGIN_TYPE.VALUES.SIGNUP;
    if (isSignupFlow) {
      await authClient.login({ redirectTo, isSignupFlow: true, href: request.url });
    }
  }
};

export const Component = () => {
  return <LoginForm />;
};
