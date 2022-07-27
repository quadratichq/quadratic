import { useEffect } from 'react';
import QuadraticUI from '../ui/QuadraticUI';
import { RecoilRoot } from 'recoil';
import { useLoading } from '../contexts/LoadingContext';
import { loadPython } from '../core/computations/python/loadPython';
import { WelcomeComponent } from './WelcomeComponent';
import { AnalyticsProvider } from './AnalyticsProvider';
import { QuadraticLoading } from '../ui/QuadtraticLoading';

export default function QuadraticApp() {
  const { loading, setLoading } = useLoading();

  useEffect(() => {
    if (loading) {
      loadPython().then(() => {
        setLoading(false);
      });
    }
  }, [loading, setLoading]);

  return (
    <RecoilRoot>
      {/* Provider for Analytics. Only used when running in Quadratic Cloud. */}
      <AnalyticsProvider></AnalyticsProvider>
      {/* Welcome Component for first time users */}
      {!loading && <WelcomeComponent></WelcomeComponent>}
      {/* Provider of All React UI Components */}
      <QuadraticUI loading={loading}></QuadraticUI>
    </RecoilRoot>
  );
}
