import { authClient } from '@/auth/auth';
import { EmptyPage } from '@/shared/components/EmptyPage';
import { useLoggedInUserChange } from '@/shared/hooks/useLoggedInUserChange';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { initializeAnalytics } from '@/shared/utils/analytics';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { Outlet, useLoaderData, useRouteError } from 'react-router';

export const loader = async () => {
  const loggedInUser = await authClient.user();
  initializeAnalytics(loggedInUser);
  return { loggedInUser };
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
