import { useEffect, useState } from 'react';
import QuadraticUIContext from '../ui/QuadraticUIContext';
import { QuadraticLoading } from '../ui/loading/QuadraticLoading';
import { loadPython } from '../grid/computations/python/loadPython';
import { loadAssets } from '../gridGL/loadAssets';
import { IS_READONLY_MODE } from '../constants/app';
import { debugSkipPythonLoad } from '../debugFlags';
import init, { hello } from 'quadratic-core';
import { SheetController } from '../grid/controller/sheetController';
import { useGenerateLocalFiles } from '../hooks/useGenerateLocalFiles';
import { PixiApp } from '../gridGL/pixiApp/PixiApp';

type loadableItem = 'pixi-assets' | 'local-files' | 'wasm-rust' | 'wasm-python' | 'quadrants';
const ITEMS_TO_LOAD: loadableItem[] = ['pixi-assets', 'local-files', 'wasm-rust', 'wasm-python', 'quadrants'];
let didMount = false;
export const QuadraticApp = () => {
  const [loading, setLoading] = useState(true);
  const [itemsLoaded, setItemsLoaded] = useState<loadableItem[]>([]);
  // const didMount = useRef(false);
  const [sheetController] = useState<SheetController>(new SheetController());
  const localFiles = useGenerateLocalFiles(sheetController);
  const [app] = useState(() => new PixiApp(sheetController, localFiles.save));
  const { initialize } = localFiles;

  useEffect(() => {
    if (ITEMS_TO_LOAD.every((item) => itemsLoaded.includes(item))) {
      setLoading(false);
    }
  }, [app, itemsLoaded]);

  // Loading Effect
  useEffect(() => {
    // Ensure this only runs once
    if (didMount) {
      setLoading(false);
      return;
    }
    didMount = true;

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

    if (!IS_READONLY_MODE && !debugSkipPythonLoad) {
      loadPython().then(() => {
        setItemsLoaded((old) => ['wasm-python', ...old]);
      });
    } else {
      setItemsLoaded((old) => ['wasm-python', ...old]);
    }
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
