import { useEffect, useRef, useState } from 'react';
import { useSetRecoilState } from 'recoil';
import { loadedStateAtom } from '../atoms/loadedStateAtom';
import { InitialFile } from '../dashboard/FileRoute';
import { loadAssets } from '../gridGL/loadAssets';
import init, { hello } from '../quadratic-core/quadratic_core';
import { webWorkers } from '../web-workers/webWorkers';
import QuadraticUIContext from './QuadraticUIContext';
import { QuadraticLoading } from './loading/QuadraticLoading';

type loadableItem = 'pixi-assets' | 'wasm-rust';
const ITEMS_TO_LOAD: loadableItem[] = ['pixi-assets', 'wasm-rust'];

export default function QuadraticApp({ initialFile }: { initialFile: InitialFile }) {
  const [loading, setLoading] = useState(true);
  const [itemsLoaded, setItemsLoaded] = useState<loadableItem[]>([]);
  const setLoadedState = useSetRecoilState(loadedStateAtom);
  const didMount = useRef<boolean>(false);

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

  // Initialize loading of critical assets
  useEffect(() => {
    // Ensure this only runs once
    if (didMount.current) return;
    didMount.current = true;

    // populate web workers
    webWorkers.init();

    loadAssets().then(() => {
      setItemsLoaded((old) => ['pixi-assets', ...old]);
    });

    init().then(() => {
      hello(); // let Rust say hello to console
      setItemsLoaded((old) => ['wasm-rust', ...old]);

      // // need to wait until wasm loads before creating sheetController and app
      // setApp(new PixiApp(sc));
    });
  }, []);

  // Once everything loads, run this effect
  useEffect(() => {
    if (ITEMS_TO_LOAD.every((item) => itemsLoaded.includes(item))) {
      setLoading(false);
    }
  }, [itemsLoaded]);

  if (loading) {
    return <QuadraticLoading />;
  }

  return <QuadraticUIContext initialFile={initialFile} />;
}
