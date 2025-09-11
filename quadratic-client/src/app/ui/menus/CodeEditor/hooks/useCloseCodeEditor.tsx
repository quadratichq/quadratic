import {
  codeEditorShowCodeEditorAtom,
  codeEditorShowSaveChangesAlertAtom,
  codeEditorUnsavedChangesAtom,
} from '@/app/atoms/codeEditorAtom';
import { content } from '@/app/gridGL/pixiApp/Content';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import type * as monaco from 'monaco-editor';
import { useRecoilCallback } from 'recoil';

export const useCloseCodeEditor = ({ editorInst }: { editorInst: monaco.editor.IStandaloneCodeEditor | null }) => {
  const closeEditor = useRecoilCallback(
    ({ snapshot, set }) =>
      async (skipSaveCheck: boolean) => {
        const unsavedChanges = await snapshot.getPromise(codeEditorUnsavedChangesAtom);
        if (!skipSaveCheck && unsavedChanges) {
          set(codeEditorShowSaveChangesAlertAtom, true);
        } else {
          set(codeEditorShowCodeEditorAtom, false);
          content.cellHighlights.clear();
          multiplayer.sendEndCellEdit();
          editorInst?.dispose();
        }
      },
    [editorInst]
  );

  return { closeEditor };
};
