import { Input } from '@/shared/shadcn/ui/input';
import { Label } from '@/shared/shadcn/ui/label';
import { TooltipHint } from './TooltipHint';
import HighlightAltIcon from '@mui/icons-material/HighlightAlt';
import { Button } from '@/shared/shadcn/ui/button';
import { FocusEvent, useCallback, useEffect, useRef, useState } from 'react';
import { getSelectionString, parseSelectionString } from '@/app/grid/sheet/selection';
import { sheets } from '@/app/grid/controller/Sheets';
import { cn } from '@/shared/shadcn/utils';
import { Selection } from '@/app/quadratic-core-types';

interface Props {
  label?: string;
  initial?: Selection;
  onChangeSelection: (selection: Selection | undefined) => void;
  triggerError?: boolean;
}

export const SheetRange = (props: Props) => {
  const { onChangeSelection: onChangeRange, label, initial, triggerError } = props;
  const [rangeError, setRangeError] = useState<string | undefined>();
  const ref = useRef<HTMLInputElement>(null);

  // insert the range of the current selection
  const onInsert = useCallback(() => {
    if (ref.current) {
      const selection = sheets.getRustSelection();
      ref.current.value = getSelectionString(selection);
      onChangeRange(selection);
      setRangeError(undefined);
    }
  }, [onChangeRange]);

  const onBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      const value = e.currentTarget.value;
      const selection = parseSelectionString(value, sheets.sheet.id);
      if (selection.selection) {
        onChangeRange(selection.selection);
        setRangeError(undefined);
      } else if (selection.error) {
        onChangeRange(undefined);
        setRangeError(selection.error.error);
      } else {
        throw new Error('Invalid selection from parseSelectionRange');
      }
    },
    [onChangeRange]
  );

  useEffect(() => {
    if (ref.current) {
      ref.current.value = initial ? getSelectionString(initial) : '';
    }
  }, [initial]);

  const onFocus = () => {
    if (!ref.current) return;
    const selection = parseSelectionString(ref.current.value, sheets.sheet.id);
    if (selection.selection) {
      sheets.sheet.cursor.loadFromSelection(selection.selection);
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
