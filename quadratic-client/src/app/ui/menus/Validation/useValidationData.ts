//! Holds current Validation data and provides functions that create or change validations.
//! This is a passed-version of context for the Validation component.

import { v4 as uuid } from 'uuid';
import { sheets } from '@/app/grid/controller/Sheets';
import { Validation, ValidationRule } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from 'react';

const defaultValidation = (all: Validation[]): Validation => {
  const validation: Validation = {
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
      style: 'Stop',
      title: '',
      message: '',
    },
  };
  return validation;
};

export type SetState<T> = Dispatch<SetStateAction<T>>;

export type ValidationRuleSimple = 'none' | 'list' | 'list-range' | 'checkbox';

export interface ValidationData {
  unsaved: boolean;
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
  validate: () => boolean;
  triggerError: boolean;
}

export const useValidationData = (): ValidationData => {
  const [validation, setValidation] = useState<Validation | undefined>();
  const [originalValidation, setOriginalValidation] = useState<Validation | undefined>();
  const [validations, setValidations] = useState<Validation[]>([]);
  const [moreOptions, setMoreOptions] = useState(false);
  const [triggerError, setTriggerError] = useState(false);

  const toggleMoreOptions = useCallback(() => {
    setMoreOptions((old) => !old);
  }, []);

  // gets all validations for this sheet from core
  useEffect(() => {
    const getValidations = async () => {
      const v = await quadraticCore.getValidations(sheets.current);
      setValidations(v);
    };
    getValidations();
  }, []);

  // gets the validation for the current selection or creates a new one
  useEffect(() => {
    if (!validations) return;
    const getValidation = async () => {
      let v = await quadraticCore.getValidation(sheets.getRustSelection());
      if (v) {
        setOriginalValidation(v);
      } else {
        // this is the default Validation rule
        v = defaultValidation(validations);
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

  const validate = useCallback((): boolean => {
    if (!validation) {
      setTriggerError(true);
      return false;
    }

    // name needs to be defined unless we're using the 'none' rule (which means
    // we're deleting the validation)
    if (validation.rule !== 'None' && !validation.name.trim()) {
      setTriggerError(true);
      return false;
    }

    // ensure Selection list is not empty
    if (validation.rule !== 'None' && 'List' in validation.rule) {
      if ('List' in validation.rule.List.source) {
        if (validation.rule.List.source.List.length === 0) {
          setTriggerError(true);
          return false;
        }
      }
    }

    // ensure Selection is not empty
    if (validation.rule !== 'None' && 'List' in validation.rule) {
      if ('source' in validation.rule.List) {
        if ('Selection' in validation.rule.List.source) {
          const selection = validation.rule.List.source.Selection;
          if (!selection.columns?.length && !selection.rows?.length && !selection.rects?.length && !selection.all) {
            setTriggerError(true);
            return false;
          }
        }
      }
    }

    return true;
  }, [validation]);

  // change the rule using the simple rule type; creates a default value for that rule
  const changeRule = useCallback((type: ValidationRuleSimple) => {
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
        rule = { Checkbox: {} };
        break;

      default:
        throw new Error('Invalid rule type in useValidationData.changeRule');
    }
    setValidation((old) => {
      if (old) {
        return { ...old, rule };
      }
    });
  }, []);

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

  return {
    validate,
    unsaved,
    validation,
    rule,
    validations,
    setValidation,
    showDropdown,
    changeDropDown,
    ignoreBlank,
    changeIgnoreBlank,
    changeRule,
    moreOptions,
    toggleMoreOptions,
    triggerError,
  };
};
