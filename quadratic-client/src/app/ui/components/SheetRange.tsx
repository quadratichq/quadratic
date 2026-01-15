import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { A1Selection } from '@/app/quadratic-core-types';
import type { JsSelection } from '@/app/quadratic-core/quadratic_core';
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
  labelClassName?: string;

  initial?: A1Selection;
  onChangeSelection: (jsSelection: JsSelection | undefined) => void;
  onError?: (error: string | undefined) => void;

  // used to trigger an error if the range is empty
  triggerError?: boolean;

  // used to update the sheet's cursor to the range. If string, then it uses the
  // string as the sheetId; otherwise it uses sheets.current as the sheetId
  changeCursor?: string | true;

  readOnly?: boolean;

  onEnter?: () => void;

  onlyCurrentSheet?: string;
  onlyCurrentSheetError?: string;

  forceSheetName?: boolean;
}

export const SheetRange = (props: Props) => {
  const {
    onChangeSelection,
    label,
    initial,
    triggerError,
    changeCursor,
    readOnly,
    onlyCurrentSheet,
    onlyCurrentSheetError,
    forceSheetName,
  } = props;
  const [rangeError, setRangeError] = useState<string | undefined>();
  const [input, setInput] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isFocusingRef = useRef(false);

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
    // Pass a1SheetId to hide sheet name when it matches (unless forceSheetName is true)
    setInput(jsSelection.toA1String(forceSheetName ? undefined : a1SheetId, sheets.jsA1Context));
    onChangeSelection(jsSelection);
    setRangeError(undefined);
  }, [a1SheetId, onChangeSelection, forceSheetName]);

  const updateValue = useCallback(
    (value: string, changeSelection = true) => {
      try {
        const selection = sheets.stringToSelection(value, a1SheetId);
        onChangeSelection(selection);
        setRangeError(undefined);
        if (changeSelection && selection && selection.save() !== sheets.sheet.cursor.save()) {
          isFocusingRef.current = true;
          sheets.changeSelection(selection);

          // need to call focus again since changeSelection will change focus
          setTimeout(() => {
            inputRef.current?.focus();
            isFocusingRef.current = false;
          }, 0);
        }
      } catch (e: any) {
        try {
          const parsed = JSON.parse(e);
          if (parsed.InvalidSheetName) {
            setRangeError(onlyCurrentSheetError ?? 'Invalid sheet name');
            props.onError?.(onlyCurrentSheetError ?? 'Invalid sheet name');
          } else {
            const error = parsed.type === 'InvalidCellReference' ? 'Invalid cell reference' : parsed.type;
            setRangeError(error);
            props.onError?.(error);
          }
        } catch {}
      }
    },
    [a1SheetId, onChangeSelection, onlyCurrentSheetError, props]
  );

  const onBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      const value = e.currentTarget.value;
      // Don't change selection or refocus on blur - let the user click away
      updateValue(value, false);
    },
    [updateValue]
  );

  useEffect(() => {
    if (!initial) {
      setInput('');
      return;
    }

    const jsSelection = sheets.A1SelectionToJsSelection(initial);
    // Pass a1SheetId to hide sheet name when it matches (unless forceSheetName is true)
    setInput(jsSelection.toA1String(forceSheetName ? undefined : a1SheetId, sheets.jsA1Context));
    onChangeSelection(jsSelection);
  }, [changeCursor, a1SheetId, initial, forceSheetName, onChangeSelection]);

  const onFocus = useCallback(() => {
    if (!changeCursor) return;
    if (isFocusingRef.current) return; // prevent infinite loop

    try {
      const selection = sheets.stringToSelection(input, a1SheetId);
      if (selection && selection.save() !== sheets.sheet.cursor.save()) {
        isFocusingRef.current = true;
        sheets.changeSelection(selection);

        // need to call focus again since changeSelection will change focus
        setTimeout(() => {
          inputRef.current?.focus();
          isFocusingRef.current = false;
        }, 0);
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
      {props.label && (
        <Label className={props.labelClassName} htmlFor={label}>
          {label}
        </Label>
      )}

      <div className="flex w-full items-center space-x-2">
        <div className={'w-full'}>
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
            className={cn((rangeError || isError) && 'border-destructive')}
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
            <Button variant="outline" size="icon" onClick={onInsert} disabled={disableButton} className="flex-shrink-0">
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
