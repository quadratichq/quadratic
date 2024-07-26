import { Input } from '@/shared/shadcn/ui/input';
import { Label } from '@/shared/shadcn/ui/label';
import { TooltipHint } from '../../components/TooltipHint';
import HighlightAltIcon from '@mui/icons-material/HighlightAlt';
import { Button } from '@/shared/shadcn/ui/button';
import { ChangeEvent, useCallback, useState } from 'react';
import { getSelectionRange, parseSelectionRange } from '@/app/grid/sheet/selection';
import { sheets } from '@/app/grid/controller/Sheets';

interface Props {
  label?: string;
  initial?: string;
  onChangeRange: (range: string) => void;
}

export const SheetRange = (props: Props) => {
  const { onChangeRange, label, initial } = props;

  const [range, setRange] = useState(initial);
  const onInsert = useCallback(() => {
    setRange(getSelectionRange(sheets.sheet.cursor));
  }, []);

  const onInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.currentTarget.value;
      setRange(value);
      const validate = parseSelectionRange(value);
      if (Array.isArray(validate)) {
      } else {
        onChangeRange(value);
      }
    },
    [onChangeRange]
  );

  return (
    <div>
      {props.label && <Label htmlFor={label}>{label}</Label>}
      <div className="flex w-full items-center space-x-2">
        <Input id={props.label} value={range} onChange={onInputChange} />
        <TooltipHint title={'Insert current selection'} placement="bottom">
          <Button size="sm" onClick={onInsert}>
            <HighlightAltIcon fontSize="small" />
          </Button>
        </TooltipHint>
      </div>
    </div>
  );
};
