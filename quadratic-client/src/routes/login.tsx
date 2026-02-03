import { authClient } from '@/auth/auth';
import { SEARCH_PARAMS } from '@/shared/constants/routes';
import { getRedirectTo } from '@/shared/utils/getRedirectToOrLoginResult';
import type { LoaderFunctionArgs } from 'react-router';

// Helper to persist logs to sessionStorage for debugging
const persistLog = (message: string, data?: unknown) => {
  const logs = JSON.parse(sessionStorage.getItem('loginDebugLogs') || '[]');
  logs.push({ time: new Date().toISOString(), message, data });
  sessionStorage.setItem('loginDebugLogs', JSON.stringify(logs));
  console.log(message, data);
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  persistLog('[Login] Full request URL:', request.url);
  const url = new URL(request.url);
  persistLog('[Login] URL search params:', url.search);
  persistLog('[Login] Raw redirectTo param:', url.searchParams.get(SEARCH_PARAMS.REDIRECT_TO.KEY));

  const redirectTo = getRedirectTo(request.url) || '/';
  persistLog('[Login] Decoded redirectTo:', redirectTo);

  const isAuthenticated = await authClient.isAuthenticated();
  persistLog('[Login] isAuthenticated:', isAuthenticated);

  if (isAuthenticated) {
    persistLog('[Login] User already authenticated, redirecting to:', redirectTo);
    window.location.assign(redirectTo);
    // Wait forever to prevent React Router from continuing
    await new Promise(() => {});
  } else {
    const loginType = url.searchParams.get(SEARCH_PARAMS.LOGIN_TYPE.KEY)?.toLowerCase() ?? '';
    const isSignupFlow = loginType === SEARCH_PARAMS.LOGIN_TYPE.VALUES.SIGNUP;
    persistLog('[Login] User not authenticated, starting login flow. redirectTo:', redirectTo);
    await authClient.login({ redirectTo, isSignupFlow, href: request.url });
  }
};
