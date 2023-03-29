import { useEffect, useRef, useState } from 'react';
import QuadraticUIContext from '../ui/QuadraticUIContext';
import { QuadraticLoading } from '../ui/loading/QuadraticLoading';
import { loadPython } from '../grid/computations/python/loadPython';
import { AnalyticsProvider } from './AnalyticsProvider';
import { loadAssets } from '../gridGL/loadAssets';
import { IS_READONLY_MODE } from '../constants/app';
import { debugSkipPythonLoad } from '../debugFlags';
import init, { hello } from 'quadratic-core';
import { useGridSettings } from '../ui/menus/TopBar/SubMenus/useGridSettings';
import { SheetController } from '../grid/controller/sheetController';
import { useLocalFiles } from '../storage/useLocalFiles';
import { PixiApp } from '../gridGL/pixiApp/PixiApp';

type loadItem = 'pixi' | 'local-files' | 'wasm-rust' | 'wasm-python';
const THINGS_TO_LOAD = ['pixi', 'local-files', 'wasm-rust', 'wasm-python'] as loadItem[];

export const QuadraticApp = () => {
  const [loading, setLoading] = useState(true);
  const [thingsLoaded, setThingsLoaded] = useState<loadItem[]>([]);
  const didMount = useRef(false);
  const { setPresentationMode } = useGridSettings();
  const [settingsReset, setSettingsReset] = useState(false);
  const [sheetController] = useState<SheetController>(new SheetController());
  const localFiles = useLocalFiles(sheetController);
  const [app] = useState(() => new PixiApp(sheetController, localFiles.save));
  const { initialize } = localFiles;

  useEffect(() => {
    if (THINGS_TO_LOAD.every((item) => thingsLoaded.includes(item))) {
      setLoading(false);
    }
  }, [thingsLoaded]);

  // reset presentation mode when app starts
  useEffect(() => {
    if (!settingsReset) {
      setPresentationMode(false);
      setSettingsReset(true);
    }
  }, [setPresentationMode, settingsReset, setSettingsReset]);

  // Loading Effect
  useEffect(() => {
    // Ensure this only runs once
    if (didMount.current) return;
    didMount.current = true;

    if (!IS_READONLY_MODE && !debugSkipPythonLoad) {
      loadPython().then(() => {
        setThingsLoaded((old) => ['wasm-python', ...old]);
      });
    } else {
      setThingsLoaded((old) => ['wasm-python', ...old]);
    }
    loadAssets().then(() => {
      setThingsLoaded((old) => ['pixi', ...old]);
    });
    // load Rust wasm
    init().then(() => {
      hello(); // let Rust say hello to console
      setThingsLoaded((old) => ['wasm-rust', ...old]);
    });
    initialize().then(() => {
      setThingsLoaded((old) => ['local-files', ...old]);
    });
  }, [initialize]);

  return (
    <>
      {/* Provider for Analytics. Only used when running in Quadratic Cloud. */}
      <AnalyticsProvider></AnalyticsProvider>
      {/* Provider of All React UI Components */}
      {!loading && <QuadraticUIContext {...{ sheetController, localFiles, app }} />}
      {/* Loading screen */}
      {loading && <QuadraticLoading></QuadraticLoading>}
    </>
  );
};
