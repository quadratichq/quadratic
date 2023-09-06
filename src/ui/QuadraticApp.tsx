import init, { hello } from 'quadratic-core';
import { useEffect, useRef, useState } from 'react';
import { isMobile } from 'react-device-detect';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { isEditorOrAbove } from '../actions';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';
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
  const { permission } = useRecoilValue(editorInteractionStateAtom);
  const setLoadedState = useSetRecoilState(loadedStateAtom);
  const didMount = useRef<boolean>(false);
  const [sheetController] = useState<SheetController>(new SheetController());
  const [app] = useState(() => new PixiApp(sheetController));

  // recoil tracks whether python is loaded
  useEffect(() => {
    const loaded = () =>
      setLoadedState((prevState) => ({
        ...prevState,
        pythonLoadState: 'loaded',
      }));
    const error = () =>
      setLoadedState((prevState) => ({
        ...prevState,
        pythonLoadState: 'error',
      }));
    window.addEventListener('python-loaded', loaded);
    window.addEventListener('python-error', error);
    return () => {
      window.removeEventListener('python-loaded', loaded);
      window.removeEventListener('python-error', error);
    };
  }, [setLoadedState]);

  // Initialize loading of critical assets
  useEffect(() => {
    // Ensure this only runs once
    if (didMount.current) return;
    didMount.current = true;

    // Load python and populate web workers (if supported)
    if (!isMobile && isEditorOrAbove(permission)) {
      setLoadedState((prevState) => ({ ...prevState, pythonLoadState: 'loading' }));
      webWorkers.init(app);
    }

    loadAssets().then(() => {
      setItemsLoaded((old) => ['pixi-assets', ...old]);
    });
    init().then(() => {
      hello(); // let Rust say hello to console
      setItemsLoaded((old) => ['wasm-rust', ...old]);
    });
  }, [app, permission, setLoadedState]);

  // Once everything loads, run this effect
  useEffect(() => {
    if (ITEMS_TO_LOAD.every((item) => itemsLoaded.includes(item))) {
      setLoading(false);
    }
  }, [app, itemsLoaded, sheetController]);

  return loading ? <QuadraticLoading /> : <QuadraticUIContext sheetController={sheetController} app={app} />;
}
