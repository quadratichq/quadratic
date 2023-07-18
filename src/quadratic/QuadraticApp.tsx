import init, { hello } from 'quadratic-core';
import { useEffect, useRef, useState } from 'react';
import { useSetRecoilState } from 'recoil';
import { loadedStateAtom } from '../atoms/loadedStateAtom';
import { SheetController } from '../grid/controller/sheetController';
import { loadAssets } from '../gridGL/loadAssets';
import { PixiApp } from '../gridGL/pixiApp/PixiApp';
import { useGenerateLocalFiles } from '../hooks/useGenerateLocalFiles';
import QuadraticUIContext from '../ui/QuadraticUIContext';
import { QuadraticLoading } from '../ui/loading/QuadraticLoading';
import { webWorkers } from '../web-workers/webWorkers';

type loadableItem = 'pixi-assets' | 'local-files' | 'wasm-rust' | 'quadrants';
const ITEMS_TO_LOAD: loadableItem[] = ['pixi-assets', 'local-files', 'wasm-rust', 'quadrants'];

export const QuadraticApp = () => {
  const [loading, setLoading] = useState(true);
  const [itemsLoaded, setItemsLoaded] = useState<loadableItem[]>([]);
  const setLoadedState = useSetRecoilState(loadedStateAtom);
  const didMount = useRef(false);
  const [sheetController] = useState<SheetController>(new SheetController());

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

  // Loading Effect
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
      app.preRenderQuadrants().then(() => {
        setItemsLoaded((old) => ['quadrants', ...old]);
      });
    };

    // populate web workers
    webWorkers.init(app);

    loadAssets().then(() => {
      setItemsLoaded((old) => ['pixi-assets', ...old]);
      assets = true;
      prerenderQuadrants();
    });
    init().then(() => {
      hello(); // let Rust say hello to console
      setItemsLoaded((old) => ['wasm-rust', ...old]);
    });
    initialize().then(() => {
      setItemsLoaded((old) => ['local-files', ...old]);
      files = true;
      prerenderQuadrants();
    });
  }, [app, initialize]);

  return loading ? <QuadraticLoading /> : <QuadraticUIContext {...{ sheetController, localFiles, app }} />;
};
