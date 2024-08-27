import { events } from '@/app/events/events';
import { useUndo } from '@/app/events/useUndo';
import { javascriptWebWorker } from '@/app/web-workers/javascriptWebWorker/javascriptWebWorker';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { MultiplayerState } from '@/app/web-workers/multiplayerWebWorker/multiplayerClientMessages';
import { pythonWebWorker } from '@/app/web-workers/pythonWebWorker/pythonWebWorker';
import { useRootRouteLoaderData } from '@/routes/_root';
import { useEffect, useRef, useState } from 'react';
import { isMobile } from 'react-device-detect';
import { useRecoilValue } from 'recoil';
import { v4 } from 'uuid';
import { hasPermissionToEditFile } from '../actions';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';
import { pixiApp } from '../gridGL/pixiApp/PixiApp';
import QuadraticUIContext from './QuadraticUIContext';
import { QuadraticLoading } from './loading/QuadraticLoading';

export function QuadraticApp() {
  const didMount = useRef<boolean>(false);
  const { permissions, uuid } = useRecoilValue(editorInteractionStateAtom);
  const { loggedInUser } = useRootRouteLoaderData();

  // Loading states
  const [offlineLoading, setOfflineLoading] = useState(true); // tracks if there are offline unsent transactions
  const [multiplayerLoading, setMultiplayerLoading] = useState(true); // tracks if multiplayer is syncing

  // Initialize loading of critical assets
  useEffect(() => {
    // Ensure this only runs once
    if (didMount.current) return;
    didMount.current = true;

    // Load python and populate web workers (if supported)
    if (!isMobile && hasPermissionToEditFile(permissions)) {
      pythonWebWorker.init();
      javascriptWebWorker.init();
    }
  }, [permissions]);

  useEffect(() => {
    if (uuid && !pixiApp.initialized) {
      pixiApp.init().then(() => {
        if (!loggedInUser) {
          const anonymous = { sub: v4(), first_name: 'Anonymous', last_name: 'User' };
          multiplayer.init(uuid, anonymous, true);
        } else {
          multiplayer.init(uuid, loggedInUser, false);
        }
      });
    }
  }, [uuid, loggedInUser]);

  // wait for offline sync
  useEffect(() => {
    if (offlineLoading) {
      const updateOfflineLoading = (transactions: number) => {
        if (transactions === 0) {
          setOfflineLoading(false);
        }
      };
      events.on('offlineTransactions', updateOfflineLoading);
      return () => {
        events.off('offlineTransactions', updateOfflineLoading);
      };
    }
  }, [offlineLoading]);

  // wait for multiplayer sync
  useEffect(() => {
    if (multiplayerLoading) {
      const updateMultiplayerLoading = () => {
        setMultiplayerLoading(false);
      };
      events.on('multiplayerSynced', updateMultiplayerLoading);
      return () => {
        events.off('multiplayerSynced', updateMultiplayerLoading);
      };
    }
  }, [multiplayerLoading]);

  useEffect(() => {
    if (multiplayerLoading) {
      const updateMultiplayerLoading = (state: MultiplayerState) => {
        // multiplayer is synced, state is syncing when there are offline unsent transactions
        if (state === 'syncing' || state === 'connected') {
          setMultiplayerLoading(false);
        }
        // don't wait for multiplayer sync if unable to connect
        else if (state === 'not connected' || state === 'no internet') {
          setOfflineLoading(false);
          setMultiplayerLoading(false);
        }
      };
      events.on('multiplayerState', updateMultiplayerLoading);
      return () => {
        events.off('multiplayerState', updateMultiplayerLoading);
      };
    }
  }, [multiplayerLoading]);

  useUndo();

  // Show loading screen until everything is loaded
  if (offlineLoading || multiplayerLoading) {
    return <QuadraticLoading />;
  }
  return <QuadraticUIContext />;
}
