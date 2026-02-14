import {
  editorInteractionStateFileUuidAtom,
  editorInteractionStateTeamUuidAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useEffect, useRef } from 'react';
import { useRecoilValue } from 'recoil';
import { fileHasMemories, triggerMemoryGeneration } from './aiMemoryService';

const LOAD_CHECK_DELAY_MS = 2500;

/**
 * Listens for code cell execution completion and triggers AI memory generation.
 * Also triggers when loading a file that has content but no memories yet
 * (e.g. old files, imported CSV/Excel, duplicated files).
 *
 * This hook should be mounted once in the file editor layout.
 */
export function useAiMemoryTrigger(): void {
  const fileUuid = useRecoilValue(editorInteractionStateFileUuidAtom);
  const teamUuid = useRecoilValue(editorInteractionStateTeamUuidAtom);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileUuidRef = useRef(fileUuid);
  fileUuidRef.current = fileUuid;

  useEffect(() => {
    if (!teamUuid || !fileUuid) return;

    const handleCodeCellsUpdated = () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        triggerMemoryGeneration(teamUuid, fileUuid);
      }, 5000);
    };

    events.on('updateCodeCells', handleCodeCellsUpdated);

    loadCheckTimer.current = setTimeout(async () => {
      try {
        if (fileUuidRef.current !== fileUuid) return;
        const payload = await quadraticCore.getMemoryPayload();
        if (!payload || (payload.sheets.length === 0 && payload.codeCells.length === 0)) return;
        if (fileUuidRef.current !== fileUuid) return;
        const hasMemories = await fileHasMemories(teamUuid, fileUuid);
        if (!hasMemories && fileUuidRef.current === fileUuid) {
          triggerMemoryGeneration(teamUuid, fileUuid);
        }
      } catch {
        // Ignore; grid may not be ready or user may be offline
      }
    }, LOAD_CHECK_DELAY_MS);

    return () => {
      events.off('updateCodeCells', handleCodeCellsUpdated);
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      if (loadCheckTimer.current) {
        clearTimeout(loadCheckTimer.current);
      }
    };
  }, [teamUuid, fileUuid]);
}
