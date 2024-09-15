import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { useEffect } from 'react';
import { useRecoilState } from 'recoil';

// Handles passing between events and editorInteractionStateAtom
export const useEvents = () => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);

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

  useEffect(() => {
    events.emit('validation', editorInteractionState.showValidation);
  }, [editorInteractionState]);
};
