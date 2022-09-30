import * as React from 'react';
import { useAuth0 } from '@auth0/auth0-react';

import './styles.css';

import { LoadingProvider } from './contexts/LoadingContext';

import QuadraticApp from './quadratic/QuadraticApp';
import { isWASMSupported } from './utils/isWASMSupported';
import { BrowserNotSupported } from './ui/overlays/BrowserNotSupported';
import { WelcomeScreen } from './core/WelcomeScreen';

export default function App() {
  const { isLoading: Auth0IsLoading, isAuthenticated: Auth0IsAuthenticated, error: Auth0Error } = useAuth0();

  // TODO: also check client WebGL support
  if (!isWASMSupported) return <BrowserNotSupported></BrowserNotSupported>;

  if (Auth0IsLoading) {
    return <div>Loading...</div>;
  }

  if (Auth0Error) {
    return <div>Oops... {Auth0Error.message}</div>;
  }

  if (!Auth0IsAuthenticated) return <WelcomeScreen></WelcomeScreen>;

  // // redirect to Login in not Auth
  // if (!isAuth0Loading && !error && !isAuthenticated) loginWithRedirect({ screen_hint: 'signup' });

  return (
    <LoadingProvider>
      {/* Provider of QuadraticApp */}
      <QuadraticApp></QuadraticApp>
    </LoadingProvider>
  );
}
