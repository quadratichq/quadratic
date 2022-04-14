import { useEffect } from 'react';
import QuadraticUI from '../ui/QuadraticUI';
import QuadraticGrid from '../core/gridGL/QuadraticGrid';
import { RecoilRoot } from 'recoil';
import { useLoading } from '../contexts/LoadingContext';
import { QuadraticLoading } from '../ui/QuadtraticLoading';
import { loadPython } from '../core/computations/python/loadPython';
import { TopBarLoading } from '../ui/components/TopBarLoading';
import { WelcomeComponent } from './WelcomeComponent';
import { AnalyticsProvider } from './AnalyticsProvider';

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
      {/* Provider for Analytics when running in Cloud mode */}
      <AnalyticsProvider></AnalyticsProvider>
      {/* Welcome Component for first time users */}
      {!loading && <WelcomeComponent></WelcomeComponent>}
      {/* Provider of WebGL Canvas and Quadratic Grid */}
      <QuadraticGrid></QuadraticGrid>
      {/* Provider of All React UI Components */}
      {!loading && <QuadraticUI></QuadraticUI>}
      {/* ToBarLoading allows window to be moved while loading in electron */}
      {loading && <TopBarLoading></TopBarLoading>}
      {/* Loading screen */}
      {loading && <QuadraticLoading></QuadraticLoading>}
    </RecoilRoot>
  );
}
