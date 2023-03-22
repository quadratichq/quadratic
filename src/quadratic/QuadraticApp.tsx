import { useEffect, useState } from 'react';
import QuadraticUIContext from '../ui/QuadraticUIContext';
import { RecoilRoot } from 'recoil';
import { useLoading } from '../contexts/LoadingContext';
import { QuadraticLoading } from '../ui/loading/QuadraticLoading';
import { loadPython } from '../grid/computations/python/loadPython';
import { AnalyticsProvider } from './AnalyticsProvider';
import { loadAssets } from '../gridGL/loadAssets';
import { IS_READONLY_MODE } from '../constants/app';
import { debugSkipPythonLoad } from '../debugFlags';

import { localFiles } from '../grid/sheet/localFiles';
import init, { hello } from 'quadratic-core';
import { useGridSettings } from '../ui/menus/TopBar/SubMenus/useGridSettings';

export const QuadraticApp = () => {
  const { loading, incrementLoadingCount } = useLoading();
  const { setPresentationMode } = useGridSettings();
  const [settingsReset, setSettingsReset] = useState(false);

  // reset presentation mode when app starts
  useEffect(() => {
    if (!settingsReset) {
      setPresentationMode(false);
      setSettingsReset(true);
    }
  }, [setPresentationMode, settingsReset, setSettingsReset]);

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

  return (
    <RecoilRoot>
      {/* Provider for Analytics. Only used when running in Quadratic Cloud. */}
      <AnalyticsProvider></AnalyticsProvider>
      {/* Provider of All React UI Components */}
      {!loading && <QuadraticUIContext />}
      {/* Loading screen */}
      {loading && <QuadraticLoading></QuadraticLoading>}
    </RecoilRoot>
  );
};
