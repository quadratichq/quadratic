import { useEffect, useRef, useState } from 'react';
import { useSetRecoilState } from 'recoil';
import { loadedStateAtom } from '../atoms/loadedStateAtom';
import { Grid } from '../grid/controller/Grid';
import { SheetController } from '../grid/controller/_sheetController';
import { loadAssets } from '../gridGL/loadAssets';
import { PixiApp } from '../gridGL/pixiApp/PixiApp';
import { pixiAppEvents } from '../gridGL/pixiApp/PixiAppEvents';
import { useGenerateLocalFiles } from '../hooks/useGenerateLocalFiles';
import QuadraticUIContext from '../ui/QuadraticUIContext';
import { QuadraticLoading } from '../ui/loading/QuadraticLoading';
import { webWorkers } from '../web-workers/webWorkers';
import { AnalyticsProvider } from './AnalyticsProvider';

type loadableItem = 'pixi-assets' | 'local-files';
const ITEMS_TO_LOAD: loadableItem[] = ['pixi-assets', 'local-files'];

export const QuadraticApp = () => {
  const [loading, setLoading] = useState(true);
  const [itemsLoaded, setItemsLoaded] = useState<loadableItem[]>([]);
  const setLoadedState = useSetRecoilState(loadedStateAtom);
  const didMount = useRef(false);
  const [grid] = useState(() => new Grid());
  const [sheetController] = useState(() => new SheetController(grid));
  const localFiles = useGenerateLocalFiles(sheetController, grid);
  const [app] = useState(() => new PixiApp(grid, sheetController, localFiles.save));
  const { initialize } = localFiles;

  useEffect(() => {
    const finalize = async () => {
      await pixiAppEvents.rebuild();
      setLoading(false);
    };

    if (ITEMS_TO_LOAD.every((item) => itemsLoaded.includes(item))) {
      finalize();
    }
  }, [app, itemsLoaded]);

  // recoil tracks whether python is loaded
  useEffect(() => {
    const loaded = () =>
      setLoadedState((loaded) => {
        return {
          ...loaded,
          pythonLoaded: true,
        };
      });
    const error = () =>
      setLoadedState((loaded) => {
        return {
          ...loaded,
          pythonLoaded: 'error',
        };
      });
    window.addEventListener('python-loaded', loaded);
    window.addEventListener('python-error', error);
    return () => {
      window.removeEventListener('python-loaded', loaded);
      window.removeEventListener('python-error', error);
    };
  }, [setLoadedState]);

  // Loading
  useEffect(() => {
    // Ensure this only runs once
    if (didMount.current) return;
    didMount.current = true;

    // populate web workers
    webWorkers.init(app);

    loadAssets().then(() => {
      setItemsLoaded((old) => ['pixi-assets', ...old]);
    });
    initialize().then(() => {
      setItemsLoaded((old) => ['local-files', ...old]);
    });
  }, [app, initialize]);

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
