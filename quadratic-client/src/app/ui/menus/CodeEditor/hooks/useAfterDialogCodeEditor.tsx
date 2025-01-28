import {
  codeEditorAtom,
  codeEditorEscapePressedAtom,
  codeEditorShowSaveChangesAlertAtom,
  codeEditorWaitingForEditorClose,
} from '@/app/atoms/codeEditorAtom';
import { editorInteractionStateShowCellTypeMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { useCloseCodeEditor } from '@/app/ui/menus/CodeEditor/hooks/useCloseCodeEditor';
import type * as monaco from 'monaco-editor';
import { useRecoilCallback } from 'recoil';

export const useAfterDialogCodeEditor = ({
  editorInst,
}: {
  editorInst: monaco.editor.IStandaloneCodeEditor | null;
}) => {
  const { closeEditor } = useCloseCodeEditor({
    editorInst,
  });

  const afterDialog = useRecoilCallback(
    ({ snapshot, set }) =>
      async () => {
        const editorEscapePressed = await snapshot.getPromise(codeEditorEscapePressedAtom);
        const waitingForEditorClose = await snapshot.getPromise(codeEditorWaitingForEditorClose);

        set(codeEditorShowSaveChangesAlertAtom, false);

        if (editorEscapePressed) {
          closeEditor(true);
        }
        if (waitingForEditorClose) {
          set(editorInteractionStateShowCellTypeMenuAtom, waitingForEditorClose.showCellTypeMenu);
          set(codeEditorAtom, (prev) => ({
            ...prev,
            showCodeEditor: !waitingForEditorClose.showCellTypeMenu && !waitingForEditorClose.inlineEditor,
            codeCell: waitingForEditorClose.codeCell,
            initialCode: waitingForEditorClose.initialCode,
            waitingForEditorClose: undefined,
          }));
          if (waitingForEditorClose.inlineEditor) {
            pixiAppSettings.changeInput(true);
          }
        } else {
          closeEditor(true);
        }
      },
    [closeEditor]
  );

  return { afterDialog };
};
