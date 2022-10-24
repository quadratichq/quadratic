import { useEffect } from 'react';
import QuadraticUI from '../ui/QuadraticUI';
import { RecoilRoot } from 'recoil';
import { useLoading } from '../contexts/LoadingContext';
import { QuadraticLoading } from '../ui/QuadtraticLoading';
import { loadPython } from '../core/computations/python/loadPython';
import { WelcomeComponent } from './WelcomeComponent';
import { AnalyticsProvider } from './AnalyticsProvider';
import { loadAssets } from '../core/gridGL/loadAssets';
import { useAuth0 } from '@auth0/auth0-react';
import { captureException } from '@sentry/react';

export default function QuadraticApp() {
  const { loading, incrementLoadingCount } = useLoading();
  const {
    isLoading: Auth0IsLoading,
    error: Auth0Error,
    isAuthenticated: Auth0IsAuthenticated,
    loginWithRedirect,
  } = useAuth0();

  // Loading Effect
  useEffect(() => {
    if (loading) {
      loadPython().then(() => {
        incrementLoadingCount();
      });
      loadAssets().then(() => {
        incrementLoadingCount();
      });
    }
  }, [loading, incrementLoadingCount]);

  if (Auth0IsLoading) {
    return <QuadraticLoading></QuadraticLoading>;
  }

  if (Auth0Error) {
    captureException(Auth0Error);
    return <div>Authentication Error: {Auth0Error.message}</div>;
  }

  if (!Auth0IsAuthenticated) loginWithRedirect({ screen_hint: 'signup' });

  return (
    <RecoilRoot>
      {/* Provider for Analytics. Only used when running in Quadratic Cloud. */}
      <AnalyticsProvider></AnalyticsProvider>
      {/* Welcome Component for first time users */}
      {!loading && <WelcomeComponent></WelcomeComponent>}
      {/* Provider of All React UI Components */}
      {!loading && <QuadraticUI></QuadraticUI>}
      {/* Loading screen */}
      {loading && <QuadraticLoading></QuadraticLoading>}
    </RecoilRoot>
  );
}
