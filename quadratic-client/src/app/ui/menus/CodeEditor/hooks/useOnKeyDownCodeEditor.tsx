import { hasPermissionToEditFile } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import { editorInteractionStatePermissionsAtom } from '@/app/atoms/editorInteractionStateAtom';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts';
import { dispatchEditorAction } from '@/app/ui/menus/CodeEditor/CodeEditor';
import { useCancelRun } from '@/app/ui/menus/CodeEditor/hooks/useCancelRun';
import { useSaveAndRunCell } from '@/app/ui/menus/CodeEditor/hooks/useSaveAndRunCell';
import { useCallback } from 'react';
import { useRecoilValue } from 'recoil';

export const useOnKeyDownCodeEditor = () => {
  const permissions = useRecoilValue(editorInteractionStatePermissionsAtom);

  const { saveAndRunCell } = useSaveAndRunCell();
  const { cancelRun } = useCancelRun();

  const onKeyDownCodeEditor = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // Command + Plus
      if (matchShortcut(Action.ZoomIn, event)) {
        event.preventDefault();
        event.stopPropagation();
        dispatchEditorAction('editor.action.fontZoomIn');
      }

      // Command + Minus
      if (matchShortcut(Action.ZoomOut, event)) {
        event.preventDefault();
        event.stopPropagation();
        dispatchEditorAction('editor.action.fontZoomOut');
      }

      // Command + 0
      if (matchShortcut(Action.ZoomTo100, event)) {
        event.preventDefault();
        event.stopPropagation();
        dispatchEditorAction('editor.action.fontZoomReset');
      }

      // Don't allow the shortcuts below for certain users
      if (!hasPermissionToEditFile(permissions)) {
        return;
      }

      // Command + S
      if (matchShortcut(Action.Save, event)) {
        event.preventDefault();
        saveAndRunCell();
      }

      // Command + Enter
      if (matchShortcut(Action.ExecuteCode, event)) {
        event.preventDefault();
        event.stopPropagation();
        saveAndRunCell();
      }

      // Command + Escape
      if (matchShortcut(Action.CancelExecution, event)) {
        event.preventDefault();
        event.stopPropagation();
        cancelRun();
      }
    },
    [cancelRun, permissions, saveAndRunCell]
  );

  return { onKeyDownCodeEditor };
};
