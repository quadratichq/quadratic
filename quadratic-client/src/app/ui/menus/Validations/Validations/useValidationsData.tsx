import { sheets } from '@/app/grid/controller/Sheets';
import { Validation } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useEffect, useState } from 'react';

export interface ValidationsData {
  sheetId: string;
  validations: Validation[];
}

export const useValidationsData = () => {
  const [sheetId] = useState(sheets.sheet.id);

  // gets all validations for this sheet from core
  const [validations, setValidations] = useState<Validation[]>([]);
  useEffect(() => {
    const getValidations = async () => {
      const v = await quadraticCore.getValidations(sheets.current);
      setValidations(v);
    };
    getValidations();
  }, []);

  return {
    sheetId,
    validations,
  };
};
