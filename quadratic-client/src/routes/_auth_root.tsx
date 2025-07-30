import { authClient } from '@/auth/auth';
import { EmptyPage } from '@/shared/components/EmptyPage';
import { initializeAnalytics } from '@/shared/utils/analytics';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { useMemo } from 'react';
import { Outlet, useNavigation, useRevalidator, useRouteError } from 'react-router';

export const loader = async () => {
  const user = await authClient.user();
  initializeAnalytics(user);
};

export const Component = () => {
  const navigation = useNavigation();
  const revalidator = useRevalidator();

  const isLoading = useMemo(
    () => revalidator.state !== 'idle' || navigation.state !== 'idle',
    [revalidator, navigation]
  );

  return (
    <div className={`${isLoading ? 'pointer-events-none overflow-hidden opacity-75' : 'overflow-auto'}`}>
      <Outlet />
    </div>
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
