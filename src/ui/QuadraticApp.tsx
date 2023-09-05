import init, { hello } from 'quadratic-core';
import { useEffect, useRef, useState } from 'react';
import { useSetRecoilState } from 'recoil';
import { loadedStateAtom } from '../atoms/loadedStateAtom';
import { SheetController } from '../grid/controller/sheetController';
import { loadAssets } from '../gridGL/loadAssets';
import { PixiApp } from '../gridGL/pixiApp/PixiApp';
import { webWorkers } from '../web-workers/webWorkers';
import QuadraticUIContext from './QuadraticUIContext';
import { QuadraticLoading } from './loading/QuadraticLoading';

type loadableItem = 'pixi-assets' | 'wasm-rust';
const ITEMS_TO_LOAD: loadableItem[] = ['pixi-assets', 'wasm-rust'];

export default function QuadraticApp() {
  const [loading, setLoading] = useState(true);
  const [itemsLoaded, setItemsLoaded] = useState<loadableItem[]>([]);
  const setLoadedState = useSetRecoilState(loadedStateAtom);
  const didMount = useRef<boolean>(false);
  const [sheetController] = useState<SheetController>(new SheetController());
  const [app] = useState(() => new PixiApp(sheetController));

  // recoil tracks whether python is loaded
  useEffect(() => {
    const loading = () =>
      setLoadedState((loaded) => ({
        ...loaded,
        pythonLoadState: 'loading',
      }));
    const loaded = () =>
      setLoadedState((loaded) => ({
        ...loaded,
        pythonLoadState: 'loaded',
      }));
    const error = () =>
      setLoadedState((loaded) => ({
        ...loaded,
        pythonLoadState: 'error',
      }));
    const skipped = () =>
      setLoadedState((loaded) => ({
        ...loaded,
        pythonLoadState: 'skipped',
      }));
    window.addEventListener('python-loading', loading);
    window.addEventListener('python-loaded', loaded);
    window.addEventListener('python-skipped', skipped);
    window.addEventListener('python-error', error);
    return () => {
      window.removeEventListener('python-loading', loading);
      window.removeEventListener('python-loaded', loaded);
      window.removeEventListener('python-skipped', skipped);
      window.removeEventListener('python-error', error);
    };
  }, [setLoadedState]);

  // Initialize loading of critical assets
  useEffect(() => {
    // Ensure this only runs once
    if (didMount.current) return;
    didMount.current = true;

    // populate web workers
    webWorkers.init(app);

    loadAssets().then(() => {
      setItemsLoaded((old) => ['pixi-assets', ...old]);
    });
    init().then(() => {
      hello(); // let Rust say hello to console
      setItemsLoaded((old) => ['wasm-rust', ...old]);
    });
  }, [app]);

  // Once everything loads, run this effect
  useEffect(() => {
    if (ITEMS_TO_LOAD.every((item) => itemsLoaded.includes(item))) {
      setLoading(false);
    }
  }, [app, itemsLoaded, sheetController]);

  return loading ? <QuadraticLoading /> : <QuadraticUIContext sheetController={sheetController} app={app} />;
}
