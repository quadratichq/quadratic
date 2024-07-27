import { Input } from '@/shared/shadcn/ui/input';
import { Label } from '@/shared/shadcn/ui/label';
import { TooltipHint } from '../../components/TooltipHint';
import HighlightAltIcon from '@mui/icons-material/HighlightAlt';
import { Button } from '@/shared/shadcn/ui/button';
import { FocusEvent, useCallback, useEffect, useRef, useState } from 'react';
import { getSelectionRange, parseSelectionRange } from '@/app/grid/sheet/selection';
import { sheets } from '@/app/grid/controller/Sheets';
import { cn } from '@/shared/shadcn/utils';

interface Props {
  label?: string;
  initial?: string;
  onChangeRange: (range: string) => void;
  multipleSheets?: boolean;
  triggerError?: boolean;
}

export const SheetRange = (props: Props) => {
  const { onChangeRange, label, initial, triggerError } = props;
  const [rangeError, setRangeError] = useState<string | undefined>();
  const ref = useRef<HTMLInputElement>(null);

  // insert the range of the current selection
  const onInsert = useCallback(() => {
    if (ref.current) {
      ref.current.value = getSelectionRange(sheets.sheet.cursor);
      onChangeRange(ref.current.value);
      setRangeError(undefined);
    }
  }, [onChangeRange]);

  const onBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      const value = e.currentTarget.value;
      const validate = parseSelectionRange(value);
      if (Array.isArray(validate)) {
        onChangeRange('');
        setRangeError(validate[0]);
      } else {
        onChangeRange(value);
        setRangeError(undefined);
      }
    },
    [onChangeRange]
  );

  useEffect(() => {
    if (ref.current) {
      ref.current.value = initial || '';
    }
  }, [initial]);

  const onFocus = () => {
    if (!ref.current) return;
    const selection = parseSelectionRange(ref.current.value);
    if (!Array.isArray(selection)) {
      sheets.sheet.cursor.loadFromSelection(selection);
    }
  };

  const isError = triggerError && (!ref.current || ref.current.value === '');
  return (
    <div>
      {props.label && <Label htmlFor={label}>{label}</Label>}
      <div className="flex w-full items-center space-x-2">
        <div className={cn('w-full', rangeError || isError ? 'border border-red-500' : '')}>
          <Input ref={ref} id={props.label} onBlur={onBlur} onFocus={onFocus} />
        </div>
        <TooltipHint title={'Insert current selection'} placement="bottom">
          <Button size="sm" onClick={onInsert}>
            <HighlightAltIcon fontSize="small" />
          </Button>
        </TooltipHint>
      </div>
      {rangeError && <div className="text-xs text-red-500">{rangeError}</div>}
      {!rangeError && isError && <div className="text-xs text-red-500">Empty range</div>}
    </div>
  );
};
