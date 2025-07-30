import { authClient } from '@/auth/auth';
import { waitForAuthClientToRedirect } from '@/auth/auth.helper';
import { AuthFormWrapper } from '@/shared/components/auth/AuthFormWrapper';
import { SignupForm } from '@/shared/components/auth/SignupForm';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { getRedirectTo } from '@/shared/utils/getRedirectToOrLoginResult';
import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const redirectTo = getRedirectTo() || '/';

  const isAuthenticated = await authClient.isAuthenticated();
  if (isAuthenticated) {
    window.location.assign(redirectTo);
    await waitForAuthClientToRedirect();
  }

  return { isRedirecting: false };
};

export const Component = () => {
  const { isRedirecting } = useLoaderData<typeof loader>();

  useRemoveInitialLoadingUI(true);

  if (isRedirecting) {
    return null;
  }

  return (
    <AuthFormWrapper>
      <SignupForm />
    </AuthFormWrapper>
  );
};
