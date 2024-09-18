import {
  editorInteractionStateRedoAtom,
  editorInteractionStateShowValidationAtom,
  editorInteractionStateUndoAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { useEffect } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

// Handles passing between events and editorInteractionStateAtom
export const useEvents = () => {
  const showValidation = useRecoilValue(editorInteractionStateShowValidationAtom);
  const setUndo = useSetRecoilState(editorInteractionStateUndoAtom);
  const setRedo = useSetRecoilState(editorInteractionStateRedoAtom);

  useEffect(() => {
    const handleUndoRedo = (undo: boolean, redo: boolean) => {
      setUndo(undo);
      setRedo(redo);
    };

    events.on('undoRedo', handleUndoRedo);
    return () => {
      events.off('undoRedo', handleUndoRedo);
    };
  }, [setRedo, setUndo]);

  useEffect(() => {
    events.emit('validation', showValidation);
  }, [showValidation]);
};
