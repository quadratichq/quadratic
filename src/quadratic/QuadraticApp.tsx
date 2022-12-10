import { useEffect, useState } from 'react';
import QuadraticUI from '../ui/QuadraticUI';
import { RecoilRoot } from 'recoil';
import { useLoading } from '../contexts/LoadingContext';
import { QuadraticLoading } from '../ui/QuadtraticLoading';
import { loadPython } from '../core/computations/python/loadPython';
import { TopBarLoading } from '../ui/components/TopBarLoading';
import { WelcomeComponent } from './WelcomeComponent';
import { AnalyticsProvider } from './AnalyticsProvider';
import { loadAssets } from '../core/gridGL/loadAssets';
import { isMobileOnly } from 'react-device-detect';
import { debugSkipPythonLoad } from '../debugFlags';
import { Sheet } from '../core/gridDB/Sheet';
import { GetCellsDBSetSheet } from '../core/gridDB/Cells/GetCellsDB';
import { localFiles } from '../core/gridDB/localFiles';

export default function QuadraticApp() {
  const { loading, incrementLoadingCount } = useLoading();
  const [sheet] = useState<Sheet>(new Sheet());

  useEffect(() => {
    if (loading) {
      if (!isMobileOnly && !debugSkipPythonLoad) {
        // Only load Python not on mobile
        loadPython().then(() => {
          incrementLoadingCount();
        });
      } else {
        // Don't load python on mobile
        incrementLoadingCount();
      }
      loadAssets().then(() => {
        incrementLoadingCount();
      });
      localFiles.initialize().then(() => {
        incrementLoadingCount();
      });
    }
  }, [loading, incrementLoadingCount]);

  // hack until rust backend is running
  useEffect(() => {
    GetCellsDBSetSheet(sheet);
  }, [sheet]);

  return (
    <RecoilRoot>
      {/* Provider for Analytics. Only used when running in Quadratic Cloud. */}
      <AnalyticsProvider></AnalyticsProvider>
      {/* Welcome Component for first time users */}
      {!loading && <WelcomeComponent sheet={sheet} />}
      {/* Provider of All React UI Components */}
      {!loading && <QuadraticUI sheet={sheet} />}
      {/* ToBarLoading allows window to be moved while loading in electron */}
      {loading && <TopBarLoading></TopBarLoading>}
      {/* Loading screen */}
      {loading && <QuadraticLoading></QuadraticLoading>}
    </RecoilRoot>
  );
}
