import { apiClient } from '@/shared/api/apiClient';
import { LoginForm } from '@/shared/components/auth/LoginForm';
import { getRedirectTo } from '@/shared/utils/getRedirectToOrLoginResult';
import type { LoaderFunctionArgs } from 'react-router';

const isWorkOs = import.meta.env.VITE_AUTH_TYPE === 'workos';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const redirectTo = getRedirectTo() || '/';

  if (isWorkOs) {
    const { url } = await apiClient.workos.login(redirectTo);
    console.log(url);
    // window.location.assign(url ?? redirectTo);
    return;
  }

  // const isAuthenticated = await authClient.isAuthenticated();
  // if (isAuthenticated) {
  //   window.location.assign(redirectTo);
  //   await waitForAuthClientToRedirect();
  // } else {
  //   const url = new URL(request.url);
  //   const loginType = url.searchParams.get(SEARCH_PARAMS.LOGIN_TYPE.KEY)?.toLowerCase() ?? '';
  //   const isSignupFlow = loginType === SEARCH_PARAMS.LOGIN_TYPE.VALUES.SIGNUP;
  //   if (isSignupFlow) {
  //     await authClient.login({ redirectTo, isSignupFlow: true, href: request.url });
  //   }
  // }
};

export const Component = () => {
  return <LoginForm />;
};
