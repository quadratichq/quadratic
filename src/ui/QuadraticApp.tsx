import { useEffect, useRef, useState } from 'react';
import { isMobile } from 'react-device-detect';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { isEditorOrAbove } from '../actions';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';
import { loadedStateAtom } from '../atoms/loadedStateAtom';
import { pixiApp } from '../gridGL/pixiApp/PixiApp';
import { webWorkers } from '../web-workers/webWorkers';
import QuadraticUIContext from './QuadraticUIContext';
import { QuadraticLoading } from './loading/QuadraticLoading';

export default function QuadraticApp({ initialFileData }: any) {
  const [loading, setLoading] = useState(true);
  const { permission } = useRecoilValue(editorInteractionStateAtom);
  const setLoadedState = useSetRecoilState(loadedStateAtom);
  const didMount = useRef<boolean>(false);

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
      webWorkers.init();
    }

    pixiApp.init().then(() => setLoading(false));
  }, [permission, setLoadedState]);

  if (loading) {
    return <QuadraticLoading />;
  }
  return <QuadraticUIContext initialFileData={initialFileData} />;
}
