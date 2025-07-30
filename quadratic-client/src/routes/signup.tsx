import { authClient } from '@/auth/auth';
import { waitForAuthClientToRedirect } from '@/auth/auth.helper';
import { SignupForm } from '@/shared/components/auth/SignupForm';
import { getRedirectTo } from '@/shared/utils/getRedirectToOrLoginResult';

export const loader = async () => {
  const redirectTo = getRedirectTo() || '/';

  const isAuthenticated = await authClient.isAuthenticated();
  if (isAuthenticated) {
    window.location.assign(redirectTo);
    await waitForAuthClientToRedirect();
  }
};

export const Component = () => {
  return <SignupForm />;
};
