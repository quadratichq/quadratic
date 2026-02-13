import { editorInteractionStateShowValidationAtom } from '@/app/atoms/editorInteractionStateAtom';
import { bigIntReplacer } from '@/app/bigint';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { useValidationsData } from '@/app/ui/menus/Validations/Validations/useValidationsData';
import { ValidationEntry } from '@/app/ui/menus/Validations/Validations/ValidationEntry';
import { ValidationsHeader } from '@/app/ui/menus/Validations/Validations/ValidationsHeader';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Button } from '@/shared/shadcn/ui/button';
import { useCallback, useEffect, useState } from 'react';
import { useSetRecoilState } from 'recoil';

export const Validations = () => {
  const setShowValidation = useSetRecoilState(editorInteractionStateShowValidationAtom);
  const validationsData = useValidationsData();
  const { validations, sheetId, readOnly } = validationsData;

  // track which validations are overlapped by the cursor
  const [highlighted, setHighlighted] = useState<string[]>([]);
  useEffect(() => {
    const checkValidations = () => {
      if (sheets.current !== sheetId) {
        setHighlighted([]);
        return;
      }
      const cursor = sheets.sheet.cursor;
      const newHighlighted = validations
        .filter((validation) => cursor.overlapsSelection(JSON.stringify(validation.selection, bigIntReplacer)))
        .map((validation) => validation.id);

      setHighlighted(newHighlighted);
    };
    checkValidations();

    events.on('cursorPosition', checkValidations);
    return () => {
      events.off('cursorPosition', checkValidations);
    };
  }, [sheetId, validations]);

  const addValidation = useCallback(() => {
    setShowValidation('new');
  }, [setShowValidation]);

  const removeValidations = useCallback(() => {
    quadraticCore.removeValidations(sheetId, false);
  }, [sheetId]);

  return (
    <div
      className="border-gray relative flex h-full shrink-0 flex-col border-l bg-background px-3 text-sm"
      style={{ width: '20rem' }}
      data-testid="validations-panel"
    >
      <ValidationsHeader />

      <div className="grow overflow-auto">
        {validations.map((validation) => (
          <ValidationEntry
            key={validation.id}
            validation={validation}
            validationsData={validationsData}
            highlight={highlighted.includes(validation.id)}
            active={validation.id === highlighted[0]}
          />
        ))}
      </div>

      {!readOnly && (
        <div className="flex w-full items-center justify-center gap-3 border-t border-t-gray-100 py-3">
          <Button variant="secondary" onClick={removeValidations}>
            Remove All
          </Button>
          <Button onClick={addValidation} autoFocus>
            Add Validation
          </Button>
        </div>
      )}
    </div>
  );
};
