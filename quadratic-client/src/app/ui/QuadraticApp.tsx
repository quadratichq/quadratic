import { hasPermissionToEditFile } from '@/app/actions';
import {
  editorInteractionStateFileUuidAtom,
  editorInteractionStatePermissionsAtom,
  editorInteractionStateUserAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { gridSettingsAtom } from '@/app/atoms/gridSettingsAtom';
import { events } from '@/app/events/events';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import QuadraticUIContext from '@/app/ui/QuadraticUIContext';
import { javascriptWebWorker } from '@/app/web-workers/javascriptWebWorker/javascriptWebWorker';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import type { MultiplayerState } from '@/app/web-workers/multiplayerWebWorker/multiplayerClientMessages';
import { pythonWebWorker } from '@/app/web-workers/pythonWebWorker/pythonWebWorker';
import { SEARCH_PARAMS } from '@/shared/constants/routes';
import { useEffect, useMemo, useRef, useState } from 'react';
import { isMobile } from 'react-device-detect';
import { useSearchParams } from 'react-router';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { v4 } from 'uuid';

export function QuadraticApp() {
  // ensure GridSettings are loaded before app starts
  useSetRecoilState(gridSettingsAtom);

  const didMount = useRef<boolean>(false);
  const permissions = useRecoilValue(editorInteractionStatePermissionsAtom);
  const loggedInUser = useRecoilValue(editorInteractionStateUserAtom);
  const fileUuid = useRecoilValue(editorInteractionStateFileUuidAtom);
  const [searchParams] = useSearchParams();
  const checkpointId = useMemo(() => searchParams.get(SEARCH_PARAMS.CHECKPOINT.KEY), [searchParams]);

  // Loading states
  const [offlineLoading, setOfflineLoading] = useState(true);
  const [multiplayerLoading, setMultiplayerLoading] = useState(true);

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
    if (fileUuid && !pixiApp.initialized) {
      pixiApp.init().then(() => {
        // If we're loading a specific checkpoint (version history), don't load multiplayer
        if (checkpointId) {
          setMultiplayerLoading(false);
          setOfflineLoading(false);
          return;
        }

        if (!loggedInUser) {
          const anonymous = { sub: v4(), first_name: 'Anonymous', last_name: 'User' };
          multiplayer.init(fileUuid, anonymous, true);
        } else {
          multiplayer.init(fileUuid, loggedInUser, false);
        }
      });
    }
  }, [fileUuid, loggedInUser, checkpointId]);

  // wait for offline sync
  useEffect(() => {
    if (offlineLoading) {
      const updateOfflineLoading = () => {
        setOfflineLoading(false);
      };
      events.on('offlineTransactionsApplied', updateOfflineLoading);
      return () => {
        events.off('offlineTransactionsApplied', updateOfflineLoading);
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
        // don't wait for multiplayer sync if unable to connect
        if (state === 'waiting to reconnect' || state === 'not connected' || state === 'no internet') {
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

  // Don't render the app until these are done — even on slow connections these
  // don't take long. We should probably move them to where we do all the other
  // async stuff before the app loads.
  if (offlineLoading || multiplayerLoading) {
    return null;
  }
  return <QuadraticUIContext />;
}
