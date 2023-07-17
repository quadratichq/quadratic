// import { QuadraticLoading } from '../ui/loading/QuadraticLoading';
import { setUser } from '@sentry/react';
// import apiClientSingleton from '../api-client/apiClientSingleton';
import { useEffect } from 'react';
// import { debug } from '../debugFlags';
// import { FILE_PARAM_KEY } from '../constants/app';
import { useRouteLoaderData } from 'react-router-dom';
import { RootLoaderData } from '../Routes';

export const QuadraticAuth = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated, user } = useRouteLoaderData('root') as RootLoaderData;

  useEffect(() => {
    if (isAuthenticated && user) {
      setUser({ email: user.email, id: user.sub });
      console.log('[Sentry] user set');
    }
  }, [isAuthenticated, user]);

  return children;
};
