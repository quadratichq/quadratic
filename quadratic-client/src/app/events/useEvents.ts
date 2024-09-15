import {
  editorInteractionStateAtom,
  editorInteractionStateShowValidationAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { useEffect } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

// Handles passing between events and editorInteractionStateAtom
export const useEvents = () => {
  const showValidation = useRecoilValue(editorInteractionStateShowValidationAtom);
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

  useEffect(() => {
    events.emit('validation', showValidation);
  }, [showValidation]);
};
