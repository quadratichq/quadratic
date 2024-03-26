import { events } from '@/events/events';
import { useUndo } from '@/events/useUndo';
import { useRootRouteLoaderData } from '@/router';
import { multiplayer } from '@/web-workers/multiplayerWebWorker/multiplayer';
import { PythonStateType } from '@/web-workers/pythonWebWorker/pythonClientMessages';
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
    const state = (state: PythonStateType, version?: string) =>
      setLoadedState((prevState) => ({
        ...prevState,
        version: version ?? prevState.version,
        pythonState: state,
      }));
    events.on('pythonState', state);
    return () => {
      events.off('pythonState', state);
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
