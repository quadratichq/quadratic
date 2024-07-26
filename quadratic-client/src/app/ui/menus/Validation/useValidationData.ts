/* eslint-disable @typescript-eslint/no-unused-vars */
import { v4 as uuid } from 'uuid';
import { sheets } from '@/app/grid/controller/Sheets';
import { Validation, ValidationRule } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from 'react';
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

export type SetState<T> = Dispatch<SetStateAction<T>>;

export type ValidationRuleSimple = 'none' | 'list' | 'list-range' | 'checkbox';

export interface ValidationData {
  unsaved: boolean;
  range: string | undefined;
  validation: Validation | undefined;
  rule: ValidationRuleSimple;
  validations: Validation[];
  setValidation: SetState<Validation | undefined>;
  changeRule: (rule: ValidationRuleSimple) => void;
  showDropdown: boolean;
  changeDropDown: (checked: boolean) => void;
  ignoreBlank: boolean;
  changeIgnoreBlank: (checked: boolean) => void;
  moreOptions: boolean;
  toggleMoreOptions: () => void;
}

export const useValidationData = (): ValidationData => {
  const [validation, setValidation] = useState<Validation | undefined>();
  const [originalValidation, setOriginalValidation] = useState<Validation | undefined>();
  const [validations, setValidations] = useState<Validation[]>([]);
  const [range, setRange] = useState(getSelectionRange(sheets.sheet.cursor));
  const [moreOptions, setMoreOptions] = useState(false);

  const toggleMoreOptions = useCallback(() => {
    setMoreOptions((old) => !old);
  }, []);

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
      if (v) {
        setOriginalValidation(v);
      } else {
        // this is the default Validation rule
        v = defaultValidation(all);
        setOriginalValidation(undefined);
      }
      setValidation(v);
    };

    getValidation();
  }, [validations]);

  const unsaved = useMemo(() => {
    if (originalValidation && validation) {
      return JSON.stringify(originalValidation) !== JSON.stringify(validation);
    }
    return true;
  }, [validation, originalValidation]);

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
      } else if ('Checkbox' in rule) {
        return 'checkbox';
      } else {
        throw new Error('Invalid rule in useValidationData.rule');
      }
    }
    return 'none';
  }, [validation]);

  // change the rule using the simple rule type; creates a default value for that rule
  const changeRule = (type: ValidationRuleSimple) => {
    let rule: ValidationRule = 'None';
    switch (type) {
      case 'none':
        rule = 'None';
        break;

      case 'list':
        rule = { List: { source: { List: [] }, ignore_blank: true, drop_down: true } };
        break;

      case 'list-range':
        rule = {
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
        break;

      case 'checkbox':
        rule = { Checkbox: { checkbox: true } };
        break;

      default:
        throw new Error('Invalid rule type in useValidationData.changeRule');
    }
    setValidation((old) => {
      if (old) {
        return { ...old, rule };
      }
    });
  };

  const showDropdown = useMemo(() => {
    const rule = validation?.rule;
    if (rule === 'None') return false;
    if (rule) {
      if ('List' in rule) {
        if ('drop_down' in rule.List) {
          return rule.List.drop_down;
        }
      }
    }
    return false;
  }, [validation]);

  const changeDropDown = (checked: boolean) => {
    setValidation((old) => {
      if (old?.rule) {
        if (old.rule === 'None') return old;
        if ('List' in old.rule) {
          return { ...old, rule: { List: { ...old.rule.List, drop_down: checked } } };
        }
      }
    });
  };

  const ignoreBlank = useMemo(() => {
    const rule = validation?.rule;
    if (rule === 'None') return false;
    if (rule) {
      if ('List' in rule) {
        if ('ignore_blank' in rule.List) {
          return rule.List.ignore_blank;
        }
      }
    }
    return false;
  }, [validation]);

  const changeIgnoreBlank = (checked: boolean) => {
    setValidation((old) => {
      if (old?.rule) {
        if (old.rule === 'None') return old;
        if ('List' in old.rule) {
          return { ...old, rule: { List: { ...old.rule.List, ignore_blank: checked } } };
        }
      }
    });
  };

  console.log(validation);

  return {
    unsaved,
    validation,
    rule,
    validations,
    setValidation,
    range,
    showDropdown,
    changeDropDown,
    ignoreBlank,
    changeIgnoreBlank,
    changeRule,
    moreOptions,
    toggleMoreOptions,
  };
};
