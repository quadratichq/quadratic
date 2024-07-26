import { Input } from '@/shared/shadcn/ui/input';
import { Label } from '@/shared/shadcn/ui/label';
import { TooltipHint } from '../../components/TooltipHint';
import HighlightAltIcon from '@mui/icons-material/HighlightAlt';
import { Button } from '@/shared/shadcn/ui/button';
import { useCallback, useState } from 'react';
import { getSelectionRange } from '@/app/grid/sheet/selection';
import { sheets } from '@/app/grid/controller/Sheets';

interface Props {
  label?: string;
  initial?: string;
}

export const SheetRange = (props: Props) => {
  const [range, setRange] = useState(props.initial);
  const onInsert = useCallback(() => {
    setRange(getSelectionRange(sheets.sheet.cursor));
  }, []);

  // todo: validate range

  return (
    <div>
      {props.label && <Label htmlFor={props.label}>{props.label}</Label>}
      <div className="flex w-full items-center space-x-2">
        <Input id={props.label} value={range} onChange={(change) => setRange(change.currentTarget.value)} />
        <TooltipHint title={'Insert current selection'} placement="bottom">
          <Button size="sm" onClick={onInsert}>
            <HighlightAltIcon fontSize="small" />
          </Button>
        </TooltipHint>
      </div>
    </div>
  );
};
