import { useEffect, useState } from 'react';
import QuadraticUI from '../ui/QuadraticUI';
import { RecoilRoot } from 'recoil';
import { useLoading } from '../contexts/LoadingContext';
import { QuadraticLoading } from '../ui/loading/QuadraticLoading';
import { loadPython } from '../grid/computations/python/loadPython';
import { FileLoadingComponent } from './FileLoadingComponent';
import { AnalyticsProvider } from './AnalyticsProvider';
import { loadAssets } from '../gridGL/loadAssets';
import { IS_READONLY_MODE } from '../constants/app';
import { debugSkipPythonLoad } from '../debugFlags';
import { GetCellsDBSetSheet } from '../grid/sheet/Cells/GetCellsDB';
import { localFiles } from '../grid/sheet/localFiles';
import { SheetController } from '../grid/controller/sheetController';
import init, { hello } from 'quadratic-core';

export const QuadraticApp = () => {
  const { loading, incrementLoadingCount } = useLoading();
  const [sheet_controller] = useState<SheetController>(new SheetController());
  const sheet = sheet_controller.sheet;

  // Loading Effect
  useEffect(() => {
    if (loading) {
      if (!IS_READONLY_MODE && !debugSkipPythonLoad) {
        loadPython().then(() => {
          incrementLoadingCount();
        });
      } else {
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
      {!loading && <FileLoadingComponent sheetController={sheet_controller} />}
      {/* Provider of All React UI Components */}
      {!loading && <QuadraticUI sheetController={sheet_controller} />}
      {/* Loading screen */}
      {loading && <QuadraticLoading></QuadraticLoading>}
    </RecoilRoot>
  );
};
