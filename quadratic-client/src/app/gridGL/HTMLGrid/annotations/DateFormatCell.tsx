import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { focusGrid } from '@/app/helpers/focusGrid';
import { DateFormat } from '@/app/ui/components/DateFormat';
import { Close } from '@mui/icons-material';
import { IconButton } from '@mui/material';
import { useRecoilState } from 'recoil';

export const DateFormatCell = () => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);

  const close = () => {
    setEditorInteractionState((state) => ({
      ...state,
      annotationState: undefined,
    }));
    focusGrid();
  };

  if (editorInteractionState.annotationState !== 'date-format') return null;
  return (
    <div
      className="pointer-events-auto rounded border bg-white p-4 shadow"
      style={{ width: 340 }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
          close();
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <div className="flex">
        <div className="text-md">Date and time format</div>
        <div className="absolute right-2 top-1">
          <IconButton sx={{ padding: 0, width: 20, height: 20 }} onClick={close}>
            <Close sx={{ padding: 0, width: 15, height: 15 }} />
          </IconButton>
        </div>
      </div>
      <DateFormat status={true} closeMenu={close} />
    </div>
  );
};
