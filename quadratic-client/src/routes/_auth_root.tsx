import { EmptyPage } from '@/shared/components/EmptyPage';
import { useLoggedInUserChange } from '@/shared/hooks/useLoggedInUserChange';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { initializeAnalytics } from '@/shared/utils/analytics';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { AuthKitProvider, useAuth } from '@workos-inc/authkit-react';
import { Outlet, useRouteError } from 'react-router';

// export const loader = async () => {
//   const loggedInUser = await workosClient.user();
//   initializeAnalytics(loggedInUser);
//   return { loggedInUser };
// };

export const Component = () => {
  const { user } = useAuth();
  initializeAnalytics(user);

  // const { loggedInUser } = useLoaderData<typeof loader>();
  useLoggedInUserChange({ loggedInUser: user });

  // const navigation = useNavigation();
  // const revalidator = useRevalidator();

  // const isLoading = useMemo(
  //   () => revalidator.state !== 'idle' || navigation.state !== 'idle',
  //   [revalidator, navigation]
  // );

  useRemoveInitialLoadingUI();

  <AuthKitProvider clientId={import.meta.env.VITE_WORKOS_CLIENT_ID as string}>
    <Outlet />
  </AuthKitProvider>;

  // return (
  //   <AuthFormWrapper className={`${isLoading ? 'pointer-events-none overflow-hidden opacity-75' : 'overflow-auto'}`}>
  //     <Outlet />
  //   </AuthFormWrapper>
  // );
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
