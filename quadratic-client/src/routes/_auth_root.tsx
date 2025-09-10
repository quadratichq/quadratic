import { authClient } from '@/auth/auth';
import { AuthFormWrapper } from '@/shared/components/auth/AuthFormWrapper';
import { EmptyPage } from '@/shared/components/EmptyPage';
import { useLoggedInUserChange } from '@/shared/hooks/useLoggedInUserChange';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { initializeAnalytics } from '@/shared/utils/analytics';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { useMemo } from 'react';
import { Outlet, useLoaderData, useNavigation, useRevalidator, useRouteError } from 'react-router';

export const loader = async () => {
  const loggedInUser = await authClient.user();
  initializeAnalytics(loggedInUser);
  return { loggedInUser };
};

export const Component = () => {
  const { loggedInUser } = useLoaderData<typeof loader>();
  useLoggedInUserChange({ loggedInUser });

  const navigation = useNavigation();
  const revalidator = useRevalidator();

  const isLoading = useMemo(
    () => revalidator.state !== 'idle' || navigation.state !== 'idle',
    [revalidator, navigation]
  );

  useRemoveInitialLoadingUI();

  return (
    <AuthFormWrapper className={`${isLoading ? 'pointer-events-none overflow-hidden opacity-75' : 'overflow-auto'}`}>
      <Outlet />
    </AuthFormWrapper>
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
