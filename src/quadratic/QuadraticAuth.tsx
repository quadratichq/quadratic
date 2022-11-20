import { QuadraticLoading } from '../ui/loading/QuadraticLoading';

import { useAuth0 } from '@auth0/auth0-react';
import { captureException } from '@sentry/react';
import { QuadraticApp } from './QuadraticApp';

export const QuadraticAuth = () => {
  const {
    isLoading: Auth0IsLoading,
    error: Auth0Error,
    isAuthenticated: Auth0IsAuthenticated,
    loginWithRedirect,
    logout,
  } = useAuth0();

  // Auth0 is Optional
  if (process.env.REACT_APP_AUTH0_DOMAIN) {
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

  return <QuadraticApp></QuadraticApp>;
};
