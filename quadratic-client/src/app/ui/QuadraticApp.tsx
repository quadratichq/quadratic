import { initializeAIAnalyst, resetAIAnalystInitialized } from '@/app/ai/atoms/aiAnalystAtoms';
import {
  editorInteractionStateFileUuidAtom,
  editorInteractionStateUserAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { gridSettingsAtom } from '@/app/atoms/gridSettingsAtom';
import { events } from '@/app/events/events';
import { startupTimer } from '@/app/gridGL/helpers/startupTimer';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { isNoMultiplayer } from '@/app/helpers/isEmbed';
import QuadraticUIContext from '@/app/ui/QuadraticUIContext';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import type { MultiplayerState } from '@/app/web-workers/multiplayerWebWorker/multiplayerClientMessages';
import { useLoadScheduledTasks } from '@/jotai/scheduledTasksAtom';
import { SEARCH_PARAMS } from '@/shared/constants/routes';
import { preloadUserAILanguages } from '@/shared/hooks/useUserAILanguages';
import { preloadUserAIRules } from '@/shared/hooks/useUserAIRules';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useRecoilValue } from 'recoil';
import { v4 } from 'uuid';

// Preload user AI preferences early so they're ready when settings menu opens
preloadUserAIRules();
preloadUserAILanguages();

export const QuadraticApp = memo(() => {
  // Read gridSettings so its effect runs (localStorage) before any child reads aiAnalystAtom.
  // Otherwise aiAnalystAtom's effect can run first and see the default showAIAnalystOnStartup (true).
  const gridSettings = useRecoilValue(gridSettingsAtom);

  const loggedInUser = useRecoilValue(editorInteractionStateUserAtom);
  const fileUuid = useRecoilValue(editorInteractionStateFileUuidAtom);
  const [searchParams] = useSearchParams();
  const sequenceNum = useMemo(() => searchParams.get(SEARCH_PARAMS.SEQUENCE_NUM.KEY), [searchParams]);

  // Loading states
  const [offlineLoading, setOfflineLoading] = useState(true);
  const [multiplayerLoading, setMultiplayerLoading] = useState(true);

  // Load scheduled tasks
  useLoadScheduledTasks();

  // Initialize AI Analyst with user and file info
  const aiAnalystInitializedRef = useRef(false);
  const previousFileUuidRef = useRef<string | null>(null);
  useEffect(() => {
    if (previousFileUuidRef.current !== null && previousFileUuidRef.current !== fileUuid) {
      resetAIAnalystInitialized();
      aiAnalystInitializedRef.current = false;
    }
    previousFileUuidRef.current = fileUuid ?? null;
  }, [fileUuid]);
  useEffect(() => {
    if (aiAnalystInitializedRef.current) return;
    if (loggedInUser?.email && fileUuid) {
      aiAnalystInitializedRef.current = true;
      initializeAIAnalyst(loggedInUser.email, fileUuid, gridSettings.showAIAnalystOnStartup);
    }
  }, [loggedInUser?.email, fileUuid, gridSettings.showAIAnalystOnStartup]);

  useEffect(() => {
    if (fileUuid && !pixiApp.initialized) {
      pixiApp.init().then(() => {
        // If we're loading a specific checkpoint (version history) or noMultiplayer mode, don't load multiplayer
        if (sequenceNum !== null || isNoMultiplayer) {
          setMultiplayerLoading(false);
          setOfflineLoading(false);
          return;
        }
        startupTimer.start('multiplayerSync');
        if (!loggedInUser) {
          const anonymous = { sub: v4(), first_name: 'Anonymous', last_name: 'User' };
          multiplayer.init(fileUuid, anonymous, true);
        } else {
          multiplayer.init(fileUuid, loggedInUser, false);
        }
      });
    }
  }, [fileUuid, loggedInUser, sequenceNum]);

  // wait for offline sync
  useEffect(() => {
    if (offlineLoading) {
      const updateOfflineLoading = () => {
        setOfflineLoading(false);
        startupTimer.end('offlineSync');
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
        startupTimer.end('multiplayerSync');
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
});
