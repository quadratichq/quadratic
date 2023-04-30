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
import { useGenerateLocalFiles } from '../hooks/useGenerateLocalFiles';
import { PixiApp } from '../gridGL/pixiApp/PixiApp';

type loadableItem = 'pixi-assets' | 'local-files' | 'wasm-rust' | 'wasm-python';
const ITEMS_TO_LOAD: loadableItem[] = ['pixi-assets', 'local-files', 'wasm-rust', 'wasm-python'];

export const QuadraticApp = () => {
  const [loading, setLoading] = useState(true);
  const [itemsLoaded, setItemsLoaded] = useState<loadableItem[]>([]);
  const didMount = useRef(false);
  const { presentationMode, setPresentationMode } = useGridSettings();
  const [settingsReset, setSettingsReset] = useState(false);
  const [sheetController] = useState<SheetController>(new SheetController());
  const localFiles = useGenerateLocalFiles(sheetController);
  const [app] = useState(() => new PixiApp(sheetController, localFiles.save));
  const { initialize } = localFiles;

  useEffect(() => {
    if (ITEMS_TO_LOAD.every((item) => itemsLoaded.includes(item))) {
      setLoading(false);
    }
  }, [itemsLoaded, localFiles.save, sheetController]);

  // reset presentation mode when app starts
  useEffect(() => {
    if (!settingsReset) {
      if (presentationMode) setPresentationMode(false);
      setSettingsReset(true);
    }
  }, [presentationMode, setPresentationMode, settingsReset, setSettingsReset]);

  // Loading Effect
  useEffect(() => {
    // Ensure this only runs once
    if (didMount.current) return;
    didMount.current = true;

    if (!IS_READONLY_MODE && !debugSkipPythonLoad) {
      loadPython().then(() => {
        setItemsLoaded((old) => ['wasm-python', ...old]);
      });
    } else {
      setItemsLoaded((old) => ['wasm-python', ...old]);
    }
    loadAssets().then(() => {
      setItemsLoaded((old) => ['pixi-assets', ...old]);
    });
    init().then(() => {
      hello(); // let Rust say hello to console
      setItemsLoaded((old) => ['wasm-rust', ...old]);
    });
    initialize().then(() => {
      setItemsLoaded((old) => ['local-files', ...old]);
    });
  }, [initialize]);

  return (
    <>
      {/* Provider for Analytics. Only used when running in Quadratic Cloud. */}
      <AnalyticsProvider />
      {/* Provider of All React UI Components */}
      {!loading && <QuadraticUIContext {...{ sheetController, localFiles, app }} />}
      {/* Loading screen */}
      {loading && <QuadraticLoading />}
    </>
  );
};
