import { editorInteractionStateShowValidationAtom } from '@/app/atoms/editorInteractionStateAtom';
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
      if (sheets.sheet.id !== sheetId) {
        setHighlighted([]);
        return;
      }
      const cursor = sheets.sheet.cursor;
      const newHighlighted = validations
        .filter((validation) => cursor.overlapsSelection(validation.selection))
        .map((validation) => validation.id);

      setHighlighted(newHighlighted);
    };

    events.on('cursorPosition', checkValidations);
    checkValidations();
  }, [sheetId, validations]);

  const addValidation = useCallback(() => {
    setShowValidation('new');
  }, [setShowValidation]);

  const removeValidations = useCallback(() => {
    quadraticCore.removeValidations(sheetId);
  }, [sheetId]);

  return (
    <div
      className="border-gray relative flex h-full flex-col border-l bg-background px-3 py-1 text-sm"
      style={{ width: '30rem' }}
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
        <div className="mt-3 flex w-full border-t border-t-gray-100 pt-2">
          <div className="mx-auto my-1 flex gap-3">
            <Button variant="secondary" onClick={removeValidations}>
              Remove All
            </Button>
            <Button onClick={addValidation} autoFocus>
              Add Validation
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
