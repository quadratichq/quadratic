import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { Validation } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useCallback, useEffect, useState } from 'react';

export interface ValidationsData {
  sheetId: string;
  validations: Validation[];
  deleteValidation: (validationId: string) => void;
}

export const useValidationsData = () => {
  const [sheetId] = useState(sheets.sheet.id);

  // we make a copy of validations from sheet so we can delete pending ones
  // without affecting the sheet.
  const [validations, setValidations] = useState([...sheets.sheet.validations]);
  useEffect(() => {
    const updateValidations = (incomingSheetId: string, validations: Validation[]) => {
      if (incomingSheetId === sheetId) {
        setValidations(validations);
      }
    };
    events.on('sheetValidations', updateValidations);
    return () => {
      events.off('sheetValidations', updateValidations);
    };
  }, [sheetId]);

  const deleteValidation = useCallback(
    (validationId: string) => {
      quadraticCore.removeValidation(sheetId, validationId, sheets.getCursorPosition());
      setValidations((prev) => prev.filter((v) => v.id !== validationId));
    },
    [sheetId]
  );

  return {
    sheetId,
    validations,
    deleteValidation,
  };
};
