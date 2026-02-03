import { aiAnalystOfflineChats } from '@/app/ai/offline/aiAnalystChats';
import { aiAnalystAtom, aiAnalystInitialized, defaultAIAnalystState } from '@/app/atoms/aiAnalystAtom';
import {
  editorInteractionStateFileUuidAtom,
  editorInteractionStateUserAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { useEffect, useRef } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

/**
 * Hook that synchronizes AI Analyst chats when the user navigates between files.
 *
 * This hook solves a bug where AI chat messages would appear in different files
 * because the aiAnalystOfflineChats singleton retained a stale fileId when switching files.
 *
 * The hook watches for changes to the file UUID and reinitializes the AI analyst chats
 * with the correct file context.
 */
export const useAIAnalystFileSync = () => {
  const user = useRecoilValue(editorInteractionStateUserAtom);
  const fileUuid = useRecoilValue(editorInteractionStateFileUuidAtom);
  const setAIAnalystState = useSetRecoilState(aiAnalystAtom);

  // Track the previous file UUID to detect changes
  const prevFileUuidRef = useRef<string | null>(null);

  useEffect(() => {
    // Skip if not initialized yet or missing required data
    if (!aiAnalystInitialized || !user?.email || !fileUuid) {
      return;
    }

    // Skip if this is the initial mount (prevFileUuidRef is null)
    // The initial load is handled by the atom effect
    if (prevFileUuidRef.current === null) {
      prevFileUuidRef.current = fileUuid;
      return;
    }

    // Skip if the file hasn't changed
    if (prevFileUuidRef.current === fileUuid) {
      return;
    }

    // File has changed - update the ref and sync chats
    prevFileUuidRef.current = fileUuid;

    // Switch to the new file context and load its chats
    aiAnalystOfflineChats
      .switchFile(user.email, fileUuid)
      .then((chats) => {
        setAIAnalystState((prev) => ({
          ...defaultAIAnalystState,
          showAIAnalyst: prev.showAIAnalyst,
          chats,
        }));
        events.emit('aiAnalystInitialized');
      })
      .catch((error) => {
        console.error('[useAIAnalystFileSync] Failed to switch file:', error);
      });
  }, [fileUuid, user?.email, setAIAnalystState]);
};
