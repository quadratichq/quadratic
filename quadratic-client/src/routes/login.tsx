import { authClient } from '@/auth/auth';
import { waitForAuthClientToRedirect } from '@/auth/auth.helper';
import { LoginForm } from '@/shared/components/auth/LoginForm';
import { LoginFormWrapper } from '@/shared/components/auth/LoginFormWrapper';
import { EmptyPage } from '@/shared/components/EmptyPage';
import { SEARCH_PARAMS } from '@/shared/constants/routes';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { useMemo } from 'react';
import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData, useRouteError, useSearchParams } from 'react-router';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get('redirectTo') || '/';
  const loginType = url.searchParams.get(SEARCH_PARAMS.LOGIN_TYPE.KEY)?.toLowerCase() ?? '';

  const isAuthenticated = await authClient.isAuthenticated();
  if (isAuthenticated) {
    window.location.assign(redirectTo);
    await waitForAuthClientToRedirect();
  } else {
    const isRedirecting = await authClient.login(redirectTo, loginType === SEARCH_PARAMS.LOGIN_TYPE.VALUES.SIGNUP);
    return { isRedirecting };
  }

  return { isRedirecting: false };
};

export const Component = () => {
  const { isRedirecting } = useLoaderData<typeof loader>();

  const [searchParams] = useSearchParams();
  const loginType = searchParams.get(SEARCH_PARAMS.LOGIN_TYPE.KEY)?.toLowerCase() ?? '';
  const isSignupFlow = useMemo(() => loginType === SEARCH_PARAMS.LOGIN_TYPE.VALUES.SIGNUP, [loginType]);
  const isMagicAuthCodeFlow = useMemo(() => loginType === SEARCH_PARAMS.LOGIN_TYPE.VALUES.MAGIC_AUTH_CODE, [loginType]);
  const isResetPasswordFlow = useMemo(() => loginType === SEARCH_PARAMS.LOGIN_TYPE.VALUES.RESET_PASSWORD, [loginType]);
  const isVerifyEmailFlow = useMemo(() => loginType === SEARCH_PARAMS.LOGIN_TYPE.VALUES.VERIFY_EMAIL, [loginType]);

  console.log('isSignupFlow', isSignupFlow);
  console.log('isMagicAuthCodeFlow', isMagicAuthCodeFlow);
  console.log('isResetPasswordFlow', isResetPasswordFlow);
  console.log('isVerifyEmailFlow', isVerifyEmailFlow);

  // const formSchema = useMemo(() => {
  //   switch (loginType) {
  //     case SEARCH_PARAMS.LOGIN_TYPE.VALUES.SIGNUP:
  //       return ApiSchemas['/auth/signupWithPassword.POST.request'];
  //     case SEARCH_PARAMS.LOGIN_TYPE.VALUES.RESET_PASSWORD:
  //       return ApiSchemas['/auth/resetPassword.POST.request'];
  //     case SEARCH_PARAMS.LOGIN_TYPE.VALUES.MAGIC_AUTH_CODE:
  //       return ApiSchemas['/auth/sendMagicAuthCode.POST.request'];
  //     case SEARCH_PARAMS.LOGIN_TYPE.VALUES.VERIFY_EMAIL:
  //       return ApiSchemas['/auth/verifyEmail.POST.request'];
  //     default:
  //       return ApiSchemas['/auth/loginWithPassword.POST.request'];
  //   }
  // }, [loginType]);

  const redirectTo = useMemo(() => {
    const url = new URL(window.location.href);
    let redirectTo = url.searchParams.get('redirectTo');
    if (!redirectTo) {
      url.pathname = 'login-result';
      redirectTo = url.toString();
    }
    return redirectTo;
  }, []);

  useRemoveInitialLoadingUI(true);

  if (isRedirecting) {
    return null;
  }

  return (
    <LoginFormWrapper>
      <LoginForm redirectTo={redirectTo} />
    </LoginFormWrapper>
  );
};

export const ErrorBoundary = () => {
  const error = useRouteError();
  console.error(error);

  return (
    <EmptyPage
      title="Something went wrong"
      description="An unexpected error occurred. Try reloading the page or contact us if the error continues."
      Icon={ExclamationTriangleIcon}
      error={error}
    />
  );
};
