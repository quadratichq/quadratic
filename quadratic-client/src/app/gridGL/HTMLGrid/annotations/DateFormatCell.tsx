import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { focusGrid } from '@/app/helpers/focusGrid';
import { DateFormat } from '@/app/ui/components/DateFormat';
import { useCallback } from 'react';
import { useRecoilState } from 'recoil';

export const DateFormatCell = () => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);

  const close = useCallback(() => {
    setEditorInteractionState((state) => ({
      ...state,
      annotationState: undefined,
    }));
    focusGrid();
  }, [setEditorInteractionState]);

  if (editorInteractionState.annotationState !== 'date-format') return null;
  return (
    <div
      className="pointer-events-auto rounded border bg-white p-4 shadow"
      style={{ width: 340 }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
          close();
          e.preventDefault();
        }
        e.stopPropagation();
      }}
    >
      <DateFormat closeMenu={close} />
    </div>
  );
};
