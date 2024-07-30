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

  // gets all validations for this sheet from core
  const [validations, setValidations] = useState<Validation[]>([]);
  useEffect(() => {
    const getValidations = async () => {
      const v = await quadraticCore.getValidations(sheets.current);
      setValidations(v || []);
    };
    getValidations();
  }, []);

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
      setValidations((old) => old.filter((v) => v.id !== validationId));
    },
    [sheetId]
  );

  return {
    sheetId,
    validations,
    deleteValidation,
  };
};
