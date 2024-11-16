import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { Selection, stringToSelection } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { Label } from '@/shared/shadcn/ui/label';
import { cn } from '@/shared/shadcn/utils';
import HighlightAltIcon from '@mui/icons-material/HighlightAlt';
import { FocusEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TooltipHint } from './TooltipHint';

interface Props {
  label?: string;
  initial?: Selection;
  onChangeSelection: (selection: Selection | undefined) => void;

  // used to trigger an error if the range is empty
  triggerError?: boolean;

  // used to update the sheet's cursor to the range. If string, then it uses the
  // string as the sheetId; otherwise it uses sheets.sheet.id as the sheetId
  changeCursor?: string | true;

  readOnly?: boolean;

  onEnter?: () => void;

  onlyCurrentSheet?: string;
  onlyCurrentSheetError?: string;
}

export const SheetRange = (props: Props) => {
  const {
    onChangeSelection: onChangeRange,
    label,
    initial,
    triggerError,
    changeCursor,
    readOnly,
    onlyCurrentSheet,
    onlyCurrentSheetError,
  } = props;
  const [rangeError, setRangeError] = useState<string | undefined>();
  const ref = useRef<HTMLInputElement>(null);

  const a1SheetId = useMemo((): string => {
    if (onlyCurrentSheet) {
      return JSON.stringify({ id: onlyCurrentSheet });
    }
    const id = changeCursor === true ? sheets.sheet.id : changeCursor ?? sheets.sheet.id;
    return JSON.stringify({ id });
  }, [changeCursor, onlyCurrentSheet]);

  // insert the range of the current selection
  const onInsert = useCallback(() => {
    if (ref.current) {
      const selection = sheets.sheet.cursor.selection;
      ref.current.value = selection.toString(a1SheetId, sheets.getSheetIdNameMap());
      onChangeRange(selection);
      setRangeError(undefined);
    }
  }, [a1SheetId, onChangeRange]);

  const updateValue = useCallback(
    (value: string) => {
      try {
        const selection = stringToSelection(value, a1SheetId, onlyCurrentSheet ? '{}' : sheets.getSheetIdNameMap());
        onChangeRange(selection);
        setRangeError(undefined);
      } catch (e: any) {
        try {
          const parsed = JSON.parse(e);
          if (parsed.InvalidSheetName) {
            setRangeError(onlyCurrentSheetError ?? 'Invalid sheet name');
          }
        } catch (_) {
          // ignore
        }
      }
    },
    [a1SheetId, onChangeRange, onlyCurrentSheet, onlyCurrentSheetError]
  );

  const onBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      const value = e.currentTarget.value;
      updateValue(value);
    },
    [updateValue]
  );

  useEffect(() => {
    if (ref.current) {
      ref.current.value = initial ? initial.toString(a1SheetId, sheets.getRustSheetMap()) : '';
    }
  }, [changeCursor, a1SheetId, initial]);

  const onFocus = () => {
    if (!ref.current || !changeCursor) return;
    try {
      const selection = stringToSelection(
        ref.current.value,
        a1SheetId,
        onlyCurrentSheet ? '{}' : sheets.getSheetIdNameMap()
      );
      if (selection) {
        sheets.changeSelection(selection, true);
      }
    } catch (_) {
      // there was an error parsing the range, so nothing more to do
    }
  };

  const isError = triggerError && (!ref.current || ref.current.value === '');

  const [sheetId, setSheetId] = useState(sheets.sheet.id);
  useEffect(() => {
    const updateSheet = () => setSheetId(sheets.sheet.id);
    events.on('changeSheet', updateSheet);
    return () => {
      events.off('changeSheet', updateSheet);
    };
  }, []);
  const disableButton = onlyCurrentSheet ? onlyCurrentSheet !== sheetId : false;

  return (
    <div>
      {props.label && <Label htmlFor={label}>{label}</Label>}
      <div className="flex w-full items-center space-x-2">
        <div className={cn('w-full', rangeError || isError ? 'border border-red-500' : '')}>
          <Input
            ref={ref}
            id={props.label}
            onBlur={onBlur}
            onFocus={onFocus}
            readOnly={readOnly}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && props.onEnter) {
                updateValue(e.currentTarget.value);
                props.onEnter();
              }
            }}
          />
        </div>
        {!readOnly && (
          <TooltipHint
            title={disableButton ? 'Can only insert from original sheet' : 'Insert current selection'}
            placement="bottom"
          >
            <span>
              <Button size="sm" onClick={onInsert} disabled={disableButton}>
                <HighlightAltIcon fontSize="small" />
              </Button>
            </span>
          </TooltipHint>
        )}
      </div>
      {rangeError && <div className="text-xs text-red-500">{rangeError}</div>}
      {!rangeError && isError && <div className="text-xs text-red-500">Empty range</div>}
    </div>
  );
};
