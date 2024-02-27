import { editorInteractionStateAtom } from '@/atoms/editorInteractionStateAtom';
import { events } from '@/events/events';
import { useEffect } from 'react';
import { useSetRecoilState } from 'recoil';

export const useUndo = () => {
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);

  useEffect(() => {
    events.on('undoRedo', ({ undo, redo }) => {
      setEditorInteractionState((editorInteractionState) => {
        return {
          ...editorInteractionState,
          undo,
          redo,
        };
      });
    });
  }, [setEditorInteractionState]);
};
