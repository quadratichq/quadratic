import { useAuth0 } from '@auth0/auth0-react';
import { captureException, setUser } from '@sentry/react';
import { useEffect, useState } from 'react';
import apiClientSingleton from '../api-client/apiClientSingleton';
import { FILE_PARAM_KEY } from '../constants/app';
import { debug } from '../debugFlags';
import init, { hello } from '../quadratic-core';
import { QuadraticLoading } from '../ui/loading/QuadraticLoading';
import { QuadraticApp } from './QuadraticApp';

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
  const [wasmLoading, setWasmLoading] = useState(false);
  const [wasmLoadingDone, setWasmLoadingDone] = useState(false);

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

  useEffect(() => {
    if (!wasmLoading) {
      setWasmLoading(true);
      init().then(() => {
        hello(); // let Rust say hello to console
        setWasmLoadingDone(true);
      });
    }
  }, [wasmLoading]);

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
      // If we're not authenticated but there is a `file` query param,
      // store it for later so it doesn't get lost. In `useLocalFiles` we'll
      // grab it and apply it
      const file = new URLSearchParams(window.location.search).get('file');
      if (file) {
        sessionStorage.setItem(FILE_PARAM_KEY, file);
        if (debug)
          console.log('[QuadraticAuth] user is not logged in, saving `file` query param for after login: ', file);
      }

      loginWithRedirect({ screen_hint: 'signup' });
      return <QuadraticLoading></QuadraticLoading>;
    }
  }

  if (!wasmLoadingDone) {
    return <QuadraticLoading></QuadraticLoading>;
  }

  return <QuadraticApp />;
};
