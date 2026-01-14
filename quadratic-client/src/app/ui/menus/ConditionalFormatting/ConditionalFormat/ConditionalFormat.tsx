import { editorInteractionStateShowConditionalFormatAtom } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import type { A1Selection } from '@/app/quadratic-core-types';
import type { JsSelection } from '@/app/quadratic-core/quadratic_core';
import { SheetRange } from '@/app/ui/components/SheetRange';
import { ConditionalFormatHeader } from '@/app/ui/menus/ConditionalFormatting/ConditionalFormat/ConditionalFormatHeader';
import { ConditionalFormatStyleToolbar } from '@/app/ui/menus/ConditionalFormatting/ConditionalFormat/ConditionalFormatStyleToolbar';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { Label } from '@/shared/shadcn/ui/label';
import { useCallback, useMemo, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

export interface ConditionalFormatStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikeThrough?: boolean;
  textColor?: string;
  fillColor?: string;
}

export const ConditionalFormat = () => {
  const showConditionalFormat = useRecoilValue(editorInteractionStateShowConditionalFormatAtom);
  const setShowConditionalFormat = useSetRecoilState(editorInteractionStateShowConditionalFormatAtom);
  const isNew = showConditionalFormat === 'new';
  const sheetId = sheets.current;

  // Get initial selection from current cursor for new rules
  const initialSelection = useMemo((): A1Selection | undefined => {
    if (isNew) {
      return sheets.sheet.cursor.selection();
    }
    return undefined;
  }, [isNew]);

  const [selection, setSelection] = useState<JsSelection | undefined>(undefined);
  const [formula, setFormula] = useState('');
  const [style, setStyle] = useState<ConditionalFormatStyle>({});
  const [triggerError, setTriggerError] = useState(false);

  const applyConditionalFormat = useCallback(() => {
    if (!selection) {
      setTriggerError(true);
      return;
    }

    // TODO: Actually apply the conditional format via quadraticCore
    // For now, just log the values and close the panel
    console.log('Applying conditional format:', {
      selection: selection.toA1String(sheetId, sheets.jsA1Context),
      formula,
      style,
    });

    setShowConditionalFormat(true);
  }, [selection, formula, style, sheetId, setShowConditionalFormat]);

  const cancel = useCallback(() => {
    setShowConditionalFormat(true);
  }, [setShowConditionalFormat]);

  return (
    <div
      className="border-gray relative flex h-full shrink-0 flex-col border-l bg-background px-3 text-sm"
      style={{ width: '20rem' }}
      data-testid="conditional-format-edit-panel"
    >
      <ConditionalFormatHeader isNew={isNew} />

      <div className="flex flex-grow flex-col gap-5 overflow-y-auto p-1">
        <SheetRange
          label="Apply to range"
          initial={initialSelection}
          onChangeSelection={setSelection}
          triggerError={triggerError}
          changeCursor={true}
          readOnly={false}
          onlyCurrentSheet={sheetId}
          onlyCurrentSheetError="Range must be on the same sheet"
        />

        <div>
          <Label htmlFor="formula">Condition (formula)</Label>
          <Input
            id="formula"
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            placeholder="e.g., A1 > 10"
            className="mt-1"
          />
          <p className="mt-1 text-xs text-muted-foreground">Enter a formula that returns TRUE or FALSE</p>
        </div>

        <div>
          <Label>Style when condition is true</Label>
          <ConditionalFormatStyleToolbar style={style} setStyle={setStyle} />
          <StylePreview style={style} />
        </div>
      </div>

      <div className="mt-3 flex w-full justify-end gap-2 border-t border-t-gray-100 py-3">
        <Button variant="outline" onClick={cancel}>
          Cancel
        </Button>
        <Button onClick={applyConditionalFormat}>{isNew ? 'Add' : 'Save'}</Button>
      </div>
    </div>
  );
};

const StylePreview = ({ style }: { style: ConditionalFormatStyle }) => {
  const hasAnyStyle =
    style.bold || style.italic || style.underline || style.strikeThrough || style.textColor || style.fillColor;

  return (
    <div
      className="mt-2 rounded border border-border px-3 py-2"
      style={{
        backgroundColor: style.fillColor ?? undefined,
      }}
    >
      <span
        style={{
          fontWeight: style.bold ? 'bold' : undefined,
          fontStyle: style.italic ? 'italic' : undefined,
          textDecoration: [style.underline ? 'underline' : '', style.strikeThrough ? 'line-through' : '']
            .filter(Boolean)
            .join(' ') || undefined,
          color: style.textColor ?? undefined,
        }}
      >
        {hasAnyStyle ? 'Sample Text' : 'Select a style above'}
      </span>
    </div>
  );
};
