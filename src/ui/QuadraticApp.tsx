import { useEffect, useRef, useState } from 'react';
import { useSetRecoilState } from 'recoil';
import { loadedStateAtom } from '../atoms/loadedStateAtom';
import { InitialFile } from '../dashboard/FileRoute';
import { loadAssets } from '../gridGL/loadAssets';
import { pixiApp } from '../gridGL/pixiApp/PixiApp';
import { webWorkers } from '../web-workers/webWorkers';
import QuadraticUIContext from './QuadraticUIContext';
import { QuadraticLoading } from './loading/QuadraticLoading';

export default function QuadraticApp({ initialFile }: { initialFile: InitialFile }) {
  const [loading, setLoading] = useState(true);
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
      setLoading(false);
      pixiApp.init();
    });
  }, []);

  if (loading) {
    return <QuadraticLoading />;
  }

  return <QuadraticUIContext initialFile={initialFile} />;
}
