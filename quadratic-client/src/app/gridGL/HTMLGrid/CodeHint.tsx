import { showCodeHintState } from '@/app/atoms/codeHintAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { CURSOR_THICKNESS } from '@/app/gridGL/UI/Cursor';
import { useRecoilValue } from 'recoil';

export const CodeHint = () => {
  const showCodeHint = useRecoilValue(showCodeHintState);

  if (!showCodeHint) return null;

  const offset = sheets.sheet.getCellOffsets(1, 1);
  return (
    <div
      className="center pointer-events-none absolute ml-1 whitespace-nowrap pr-0.5 text-xs leading-3 text-muted-foreground"
      style={{
        left: offset.x + CURSOR_THICKNESS,
        top: offset.y + CURSOR_THICKNESS * 2,
      }}
    >
      Press / to code
    </div>
  );
};
