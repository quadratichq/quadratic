import { authClient } from '@/auth/auth';
import { isWorkOs, useWorkOs } from '@/auth/useWorkOs';
import { AuthFormWrapper } from '@/shared/components/auth/AuthFormWrapper';
import { EmptyPage } from '@/shared/components/EmptyPage';
import { useLoggedInUserChange } from '@/shared/hooks/useLoggedInUserChange';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { initializeAnalytics } from '@/shared/utils/analytics';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { useEffect, useMemo } from 'react';
import { Outlet, useLoaderData, useNavigation, useRevalidator, useRouteError } from 'react-router';

export const loader = async () => {
  if (isWorkOs) return { loggedInUser: undefined };

  const loggedInUser = await authClient.user();
  return { loggedInUser };
};

export const Component = () => {
  const { getUser } = useWorkOs();

  let { loggedInUser } = useLoaderData<typeof loader>();
  if (getUser) {
    loggedInUser = getUser() ?? undefined;
  }

  useEffect(() => {
    if (loggedInUser?.email) {
      window.localStorage.setItem('loggedInUserEmail', loggedInUser.email);
    } else {
      window.localStorage.removeItem('loggedInUserEmail');
    }

    initializeAnalytics(loggedInUser);
  }, [loggedInUser]);

  useLoggedInUserChange({ loggedInUser });

  const navigation = useNavigation();
  const revalidator = useRevalidator();

  const isLoading = useMemo(
    () => revalidator.state !== 'idle' || navigation.state !== 'idle',
    [revalidator, navigation]
  );

  useRemoveInitialLoadingUI();

  if (import.meta.env.VITE_AUTH_TYPE === 'workos') {
    return <Outlet />;
  }

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
