import { useEffect, useState } from 'react';
import QuadraticUI from '../ui/QuadraticUI';
import { RecoilRoot } from 'recoil';
import { useLoading } from '../contexts/LoadingContext';
import { QuadraticLoading } from '../ui/loading/QuadraticLoading';
import { loadPython } from '../core/computations/python/loadPython';
import { FileLoadingComponent } from './FileLoadingComponent';
import { AnalyticsProvider } from './AnalyticsProvider';
import { loadAssets } from '../core/gridGL/loadAssets';
import { isMobileOnly } from 'react-device-detect';
import { debugSkipPythonLoad } from '../debugFlags';
import { GetCellsDBSetSheet } from '../core/gridDB/Cells/GetCellsDB';
import { localFiles } from '../core/gridDB/localFiles';
import { SheetController } from '../core/transaction/sheetController';
import init, { hello } from 'quadratic-core';

export const QuadraticApp = () => {
  const { loading, incrementLoadingCount } = useLoading();
  const [sheet_controller] = useState<SheetController>(new SheetController());
  const sheet = sheet_controller.sheet;

  // Loading Effect
  useEffect(() => {
    if (loading) {
      if (!isMobileOnly && !debugSkipPythonLoad) {
        // Load Python on desktop
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
      // load Rust wasm
      init().then(() => {
        hello(); // let Rust say hello to console
        incrementLoadingCount();
      });
      localFiles.initialize().then(() => {
        incrementLoadingCount();
      });
    }
  }, [loading, incrementLoadingCount]);

  useEffect(() => {
    // temporary way to attach sheet to global for use in GetCellsDB function
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
      {/* Loading screen */}
      {loading && <QuadraticLoading></QuadraticLoading>}
    </RecoilRoot>
  );
};
