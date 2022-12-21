import { useEffect, useState } from 'react';
import QuadraticUI from '../ui/QuadraticUI';
import { RecoilRoot } from 'recoil';
import { useLoading } from '../contexts/LoadingContext';
import { QuadraticLoading } from '../ui/QuadtraticLoading';
import { loadPython } from '../core/computations/python/loadPython';
import { TopBarLoading } from '../ui/components/TopBarLoading';
import { FileLoadingComponent } from './FileLoadingComponent';
import { AnalyticsProvider } from './AnalyticsProvider';
import { loadAssets } from '../core/gridGL/loadAssets';
import { isMobileOnly } from 'react-device-detect';
import { debugSkipPythonLoad } from '../debugFlags';
import { GetCellsDBSetSheet } from '../core/gridDB/Cells/GetCellsDB';
import { localFiles } from '../core/gridDB/localFiles';
import { SheetController } from '../core/transaction/sheetController';

export default function QuadraticApp() {
  const { loading, incrementLoadingCount } = useLoading();
  const [sheet_controller] = useState<SheetController>(new SheetController());
  const sheet = sheet_controller.sheet;

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

  useEffect(() => {
    GetCellsDBSetSheet(sheet);
  }, [sheet]);

  return (
    <RecoilRoot>
      {/* Provider for Analytics. Only used when running in Quadratic Cloud. */}
      <AnalyticsProvider></AnalyticsProvider>
      {/* Welcome Component loads appropriate sheet */}
      {!loading && <FileLoadingComponent sheet={sheet} />}
      {/* Provider of All React UI Components */}
      {!loading && <QuadraticUI sheetController={sheet_controller} />}
      {/* ToBarLoading allows window to be moved while loading in electron */}
      {loading && <TopBarLoading></TopBarLoading>}
      {/* Loading screen */}
      {loading && <QuadraticLoading></QuadraticLoading>}
    </RecoilRoot>
  );
}
