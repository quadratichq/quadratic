import { multiplayer } from '@/multiplayer/multiplayer';
import { useRootRouteLoaderData } from '@/router';
import { useEffect, useRef, useState } from 'react';
import { isMobile } from 'react-device-detect';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { hasPerissionToEditFile } from '../actions';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';
import { pythonStateAtom } from '../atoms/pythonStateAtom';
import { pixiApp } from '../gridGL/pixiApp/PixiApp';
import { initializeWebWorkers } from '../web-workers/webWorkers';
import QuadraticUIContext from './QuadraticUIContext';
import { QuadraticLoading } from './loading/QuadraticLoading';

export default function QuadraticApp() {
  const { user } = useRootRouteLoaderData();

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
    if (!isMobile && hasPerissionToEditFile(permissions)) {
      setLoadedState((prevState) => ({ ...prevState, pythonState: 'loading' }));
      initializeWebWorkers();
    }
  }, [permissions, setLoadedState]);

  useEffect(() => {
    if (uuid && user && !pixiApp.initialized) {
      pixiApp.init().then(() => {
        multiplayer.enterFileRoom(uuid, user);
        setLoading(false);
      });
    }
  }, [uuid, user]);

  if (loading) {
    return <QuadraticLoading />;
  }
  return <QuadraticUIContext />;
}
