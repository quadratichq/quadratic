import { authClient } from '@/auth/auth';
import { EmptyPage } from '@/shared/components/EmptyPage';
import { useLoggedInUserChange } from '@/shared/hooks/useLoggedInUserChange';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { initializeAnalytics } from '@/shared/utils/analytics';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { captureException } from '@sentry/react';
import { Outlet, useLoaderData, useRouteError } from 'react-router';

export const loader = async () => {
  try {
    const loggedInUser = await authClient.user();
    initializeAnalytics(loggedInUser);
    return { loggedInUser, authError: undefined };
  } catch (e) {
    // Allow child routes (e.g., login-result) to handle auth failures gracefully
    // rather than triggering the error boundary on transient network errors.
    // The error is returned so child routes can distinguish "no user" from
    // "auth system failed".
    console.error('Failed to load user in auth root:', e);
    captureException(e);
    initializeAnalytics(undefined);
    return { loggedInUser: undefined, authError: e };
  }
};

export const Component = () => {
  const { loggedInUser } = useLoaderData<typeof loader>();
  useLoggedInUserChange({ loggedInUser });

  useRemoveInitialLoadingUI();

  return <Outlet />;
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
