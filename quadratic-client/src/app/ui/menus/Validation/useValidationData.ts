/* eslint-disable @typescript-eslint/no-unused-vars */
import { v4 as uuid } from 'uuid';
import { sheets } from '@/app/grid/controller/Sheets';
import { Selection, Validation, ValidationRule } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react';
import { getSelectionRange } from '@/app/grid/sheet/selection';

const defaultValidation = (all: Validation[]): Validation => {
  return {
    id: uuid(),
    name: `Validation ${all.length + 1}`,
    rule: 'None',
    message: {
      show: true,
      title: '',
      message: '',
    },
    error: {
      show: true,
      style: 'stop',
      title: '',
      message: '',
    },
  };
};

const validationRule = (type: ValidationRuleSimple): ValidationRule => {
  if (type === 'list') return { List: { source: { List: [] }, ignore_blank: true, drop_down: true } };
  if (type === 'list-range')
    return {
      List: {
        source: {
          Selection: {
            sheet_id: { id: sheets.sheet.id },
            x: BigInt(0),
            y: BigInt(0),
            rects: null,
            rows: null,
            columns: null,
            all: false,
          },
        },
        ignore_blank: true,
        drop_down: true,
      },
    };
  return 'None';
};

export type SetState<T> = Dispatch<SetStateAction<T>>;

export type ValidationRuleSimple = 'none' | 'list' | 'list-range';

export interface ValidationData {
  range: string | undefined;
  validation: Validation | undefined;
  rule: ValidationRuleSimple;
  validations: Validation[];
  setValidation: SetState<Validation | undefined>;
  validationRule: (type: ValidationRuleSimple) => ValidationRule;
}

export const useValidationData = (): ValidationData => {
  const [validation, setValidation] = useState<Validation | undefined>();
  const [validations, setValidations] = useState<Validation[]>([]);
  const [range, setRange] = useState(getSelectionRange(sheets.sheet.cursor));

  useEffect(() => {
    // gets all validations for this sheet from core
    const getValidations = async () => {
      const v = await quadraticCore.getValidations(sheets.current);
      setValidations(v);
      getValidation(v);
    };

    // gets the validation for the current selection or creates a new one
    const getValidation = async (all = validations) => {
      let v = await quadraticCore.getValidation(sheets.getRustSelection());
      if (!v) {
        // this is the default Validation rule
        v = defaultValidation(all);
      }
      setValidation(v);
    };

    getValidation();
  }, [validations]);

  const rule: ValidationRuleSimple = useMemo(() => {
    if (validation) {
      if (validation.rule === 'None') return 'none';
      const rule = validation.rule;
      if ('List' in rule) {
        if ('source' in rule.List) {
          if ('List' in rule.List.source) return 'list';
          if ('Selection' in rule.List.source) return 'list-range';
        }
        return 'list';
      }
    }
    return 'none';
  }, [validation]);
  console.log(validation);

  return { validation, rule, validations, setValidation, range, validationRule };
};
