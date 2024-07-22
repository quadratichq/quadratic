import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { useEffect } from 'react';
import { useSetRecoilState } from 'recoil';

export const useUndo = () => {
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);

  useEffect(() => {
    const handleUndoRedo = (undo: boolean, redo: boolean) => {
      setEditorInteractionState((editorInteractionState) => {
        return {
          ...editorInteractionState,
          undo,
          redo,
        };
      });
    };

    events.on('undoRedo', handleUndoRedo);
    return () => {
      events.off('undoRedo', handleUndoRedo);
    };
  }, [setEditorInteractionState]);
};
