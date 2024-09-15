import { editorInteractionStateAnnotationStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { focusGrid } from '@/app/helpers/focusGrid';
import { DateFormat } from '@/app/ui/components/DateFormat';
import { useCallback } from 'react';
import { useRecoilState } from 'recoil';

export const DateFormatCell = () => {
  const [annotationState, setAnnotationState] = useRecoilState(editorInteractionStateAnnotationStateAtom);

  const close = useCallback(() => {
    setAnnotationState(undefined);
    focusGrid();
  }, [setAnnotationState]);

  if (annotationState !== 'date-format') return null;
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
