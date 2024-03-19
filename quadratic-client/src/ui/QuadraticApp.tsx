import { useUndo } from '@/events/useUndo';
import { useRootRouteLoaderData } from '@/router';
import { multiplayer } from '@/web-workers/multiplayerWebWorker/multiplayer';
import { pythonWebWorker } from '@/web-workers/pythonWebWorker/pythonWebWorker';
import { useEffect, useRef, useState } from 'react';
import { isMobile } from 'react-device-detect';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { v4 } from 'uuid';
import { hasPermissionToEditFile } from '../actions';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';
import { pythonStateAtom } from '../atoms/pythonStateAtom';
import { pixiApp } from '../gridGL/pixiApp/PixiApp';
import QuadraticUIContext from './QuadraticUIContext';
import { QuadraticLoading } from './loading/QuadraticLoading';

export default function QuadraticApp() {
  const { loggedInUser } = useRootRouteLoaderData();

  const [loading, setLoading] = useState(true);
  const { permissions, uuid } = useRecoilValue(editorInteractionStateAtom);
  const setLoadedState = useSetRecoilState(pythonStateAtom);
  const didMount = useRef<boolean>(false);

  // recoil tracks python state
  useEffect(() => {
    const loading = () =>
      setLoadedState((prevState) => ({
        ...prevState,
        pythonState: 'loading',
      }));
    const loaded = () =>
      setLoadedState((prevState) => ({
        ...prevState,
        pythonState: 'idle',
      }));
    const error = () =>
      setLoadedState((prevState) => ({
        ...prevState,
        pythonState: 'error',
      }));
    const computationStarted = () =>
      setLoadedState((prevState) => ({
        ...prevState,
        pythonState: 'running',
      }));
    const computationFinished = () =>
      setLoadedState((prevState) => ({
        ...prevState,
        pythonState: 'idle',
      }));
    window.addEventListener('python-loading', loading);
    window.addEventListener('python-loaded', loaded);
    window.addEventListener('python-error', error);
    window.addEventListener('python-computation-started', computationStarted);
    window.addEventListener('python-computation-finished', computationFinished);
    return () => {
      window.removeEventListener('python-loading', loading);
      window.removeEventListener('python-loaded', loaded);
      window.removeEventListener('python-error', error);
      window.removeEventListener('python-computation-started', computationStarted);
      window.removeEventListener('python-computation-finished', computationFinished);
    };
  }, [setLoadedState]);

  // Initialize loading of critical assets
  useEffect(() => {
    // Ensure this only runs once
    if (didMount.current) return;
    didMount.current = true;

    // Load python and populate web workers (if supported)
    if (!isMobile && hasPermissionToEditFile(permissions)) {
      setLoadedState((prevState) => ({ ...prevState, pythonState: 'loading' }));
      pythonWebWorker.init();
    }
  }, [permissions, setLoadedState]);

  useEffect(() => {
    if (uuid && !pixiApp.initialized) {
      pixiApp.init().then(() => {
        if (!loggedInUser) {
          const anonymous = { sub: v4(), first_name: 'Anonymous', last_name: 'User' };
          multiplayer.init(uuid, anonymous, true);
        } else {
          multiplayer.init(uuid, loggedInUser, false);
        }
        setLoading(false);
      });
    }
  }, [uuid, loggedInUser]);

  useUndo();

  if (loading) {
    return <QuadraticLoading />;
  }
  return <QuadraticUIContext />;
}
