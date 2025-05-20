import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { A1Selection } from '@/app/quadratic-core-types';
import type { JsSelection } from '@/app/quadratic-core/quadratic_core';
import { A1SelectionToJsSelection, stringToSelection } from '@/app/quadratic-core/quadratic_core';
import { InsertCellRefIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { Label } from '@/shared/shadcn/ui/label';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import type { FocusEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface Props {
  label?: string;
  initial?: A1Selection;
  onChangeSelection: (jsSelection: JsSelection | undefined) => void;

  // used to trigger an error if the range is empty
  triggerError?: boolean;

  // used to update the sheet's cursor to the range. If string, then it uses the
  // string as the sheetId; otherwise it uses sheets.current as the sheetId
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
  const [input, setInput] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const a1SheetId = useMemo((): string => {
    if (onlyCurrentSheet) {
      return onlyCurrentSheet;
    }
    const id = changeCursor === true ? sheets.current : (changeCursor ?? sheets.current);
    return id;
  }, [changeCursor, onlyCurrentSheet]);

  // insert the range of the current selection
  const onInsert = useCallback(() => {
    const jsSelection = sheets.sheet.cursor.jsSelection;
    setInput(jsSelection.toA1String(a1SheetId));
    onChangeRange(jsSelection);
    setRangeError(undefined);
  }, [a1SheetId, onChangeRange]);

  const updateValue = useCallback(
    (value: string) => {
      try {
        const selection = stringToSelection(value, a1SheetId, sheets.a1Context);
        onChangeRange(selection);
        setRangeError(undefined);
        if (selection && selection.save() !== sheets.sheet.cursor.save()) {
          sheets.changeSelection(selection, true);

          // need to call focus again since changeSelection will change focus
          inputRef.current?.focus();
        }
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
    [a1SheetId, onChangeRange, onlyCurrentSheetError]
  );

  const onBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      const value = e.currentTarget.value;
      updateValue(value);
    },
    [updateValue]
  );

  useEffect(() => {
    setInput(initial ? A1SelectionToJsSelection(initial, sheets.a1Context).toA1String(a1SheetId) : '');
  }, [changeCursor, a1SheetId, initial]);

  const onFocus = useCallback(() => {
    if (!changeCursor) return;
    try {
      const selection = stringToSelection(input, a1SheetId, sheets.a1Context);
      if (selection && selection.save() !== sheets.sheet.cursor.save()) {
        sheets.changeSelection(selection, true);

        // need to call focus again since changeSelection will change focus
        inputRef.current?.focus();
      }
    } catch (_) {
      // there was an error parsing the range, so nothing more to do
    }
  }, [a1SheetId, changeCursor, input]);
  const isError = useMemo(() => triggerError && input === '', [input, triggerError]);

  const [sheetId, setSheetId] = useState(sheets.current);
  useEffect(() => {
    const updateSheet = () => setSheetId(sheets.current);
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
            ref={inputRef}
            id={props.label}
            value={input}
            onChange={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setInput(e.currentTarget.value);
            }}
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
          <TooltipPopover
            label={disableButton ? 'Can only insert from original sheet' : 'Insert current selection'}
            side="bottom"
          >
            <Button size="sm" onClick={onInsert} disabled={disableButton}>
              <InsertCellRefIcon />
            </Button>
          </TooltipPopover>
        )}
      </div>

      {rangeError && <div className="text-xs text-red-500">{rangeError}</div>}

      {!rangeError && isError && <div className="text-xs text-red-500">Empty range</div>}
    </div>
  );
};
