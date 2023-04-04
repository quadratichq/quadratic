import { QuadraticLoading } from '../ui/loading/QuadraticLoading';
import { RecoilRoot } from 'recoil';
import { useAuth0 } from '@auth0/auth0-react';
import { captureException, setUser } from '@sentry/react';
import { QuadraticApp } from './QuadraticApp';
import apiClientSingleton from '../api-client/apiClientSingleton';
import { useEffect } from 'react';

export const QuadraticAuth = () => {
  const {
    isLoading: Auth0IsLoading,
    error: Auth0Error,
    isAuthenticated: Auth0IsAuthenticated,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
    user,
  } = useAuth0();

  useEffect(() => {
    if (Auth0IsAuthenticated) {
      apiClientSingleton.setAuth(getAccessTokenSilently);
    }
  }, [Auth0IsAuthenticated, getAccessTokenSilently]);

  useEffect(() => {
    if (Auth0IsAuthenticated && user) {
      setUser({ email: user.email, id: user.sub });
    }
  }, [Auth0IsAuthenticated, user]);

  // Auth0 is Optional
  if (process.env.REACT_APP_AUTH0_DOMAIN && process.env.REACT_APP_AUTH0_DOMAIN !== 'none') {
    if (Auth0IsLoading) {
      return <QuadraticLoading></QuadraticLoading>;
    }

    if (Auth0Error) {
      captureException(Auth0Error.stack);
      return (
        <div>
          <div>Authentication Error: {Auth0Error.message}</div>
          <br></br>
          <button onClick={() => logout({ returnTo: window.location.origin })}>Log out</button>
        </div>
      );
    }

    if (!Auth0IsAuthenticated) {
      loginWithRedirect({ screen_hint: 'signup' });
      return <QuadraticLoading></QuadraticLoading>;
    }
  }

  return (
    <RecoilRoot>
      <QuadraticApp />
    </RecoilRoot>
  );
};
