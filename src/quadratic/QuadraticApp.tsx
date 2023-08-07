import { useEffect, useRef, useState } from 'react';
import { useSetRecoilState } from 'recoil';
import { loadedStateAtom } from '../atoms/loadedStateAtom';
import { SheetController } from '../grid/controller/sheetController';
import { loadAssets } from '../gridGL/loadAssets';
import { PixiApp } from '../gridGL/pixiApp/PixiApp';
import { pixiAppEvents } from '../gridGL/pixiApp/PixiAppEvents';
import { useGenerateLocalFiles } from '../hooks/useGenerateLocalFiles';
import QuadraticUIContext from '../ui/QuadraticUIContext';
import { QuadraticLoading } from '../ui/loading/QuadraticLoading';
import { webWorkers } from '../web-workers/webWorkers';
import { AnalyticsProvider } from './AnalyticsProvider';

type loadableItem = 'pixi-assets' | 'local-files' | 'quadrants';
const ITEMS_TO_LOAD: loadableItem[] = ['pixi-assets', 'local-files', 'quadrants'];

export const QuadraticApp = () => {
  const [loading, setLoading] = useState(true);
  const [itemsLoaded, setItemsLoaded] = useState<loadableItem[]>([]);
  const setLoadedState = useSetRecoilState(loadedStateAtom);
  const didMount = useRef(false);
  const [sheetController] = useState(() => new SheetController());
  const localFiles = useGenerateLocalFiles(sheetController);
  const [app] = useState(() => new PixiApp(sheetController, localFiles.save));
  const { initialize } = localFiles;

  useEffect(() => {
    if (ITEMS_TO_LOAD.every((item) => itemsLoaded.includes(item))) {
      setLoading(false);
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

    let assets = false,
      files = false;
    const prerenderQuadrants = async () => {
      // wait for local-files and pixi-assets to load before pre-rendering quadrants
      if (!assets || !files) {
        return;
      }
      pixiAppEvents.rebuild();
      // if (!app.cellsSheets) throw new Error('Expected app.cellsSheets to be defined in QuadraticApp');
      // await app.cellsSheets.create();
      setItemsLoaded((old) => ['quadrants', ...old]);
    };

    // populate web workers
    webWorkers.init(app);

    loadAssets().then(() => {
      setItemsLoaded((old) => ['pixi-assets', ...old]);
      assets = true;
      prerenderQuadrants();
    });
    initialize().then(() => {
      setItemsLoaded((old) => ['local-files', ...old]);
      files = true;
      prerenderQuadrants();
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
