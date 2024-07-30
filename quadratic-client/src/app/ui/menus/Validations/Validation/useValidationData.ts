//! Holds current Validation data and provides functions that create or change validations.
//! This is a passed-version of context for the Validation component.

import { v4 as uuid } from 'uuid';
import { sheets } from '@/app/grid/controller/Sheets';
import { Selection, Validation, ValidationRule } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from 'react';
import { getSelectionString } from '@/app/grid/sheet/selection';
import { useRecoilValue } from 'recoil';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';

export type SetState<T> = Dispatch<SetStateAction<T>>;

export type ValidationRuleSimple = 'list' | 'list-range' | 'logical' | '';

type ValidationUndefined = Validation | Omit<Validation, 'rule'> | undefined;

export interface ValidationData {
  unsaved: boolean;
  validation: ValidationUndefined | undefined;
  rule: ValidationRuleSimple;
  setValidation: SetState<ValidationUndefined | undefined>;
  setSelection: (selection: Selection | undefined) => void;
  changeRule: (rule: ValidationRuleSimple) => void;
  showDropdown: boolean;
  changeDropDown: (checked: boolean) => void;
  showCheckbox: boolean;
  changeShowCheckbox: (checked: boolean) => void;
  ignoreBlank: boolean;
  changeIgnoreBlank: (checked: boolean) => void;
  moreOptions: boolean;
  toggleMoreOptions: () => void;
  validate: () => boolean;
  triggerError: boolean;
  sheetId: string;
}

export const useValidationData = (validationId?: string): ValidationData => {
  const { showValidation } = useRecoilValue(editorInteractionStateAtom);
  const [validation, setValidation] = useState<ValidationUndefined>();
  const [originalValidation, setOriginalValidation] = useState<ValidationUndefined>();
  const [moreOptions, setMoreOptions] = useState(false);
  const [triggerError, setTriggerError] = useState(false);
  const [sheetId] = useState(sheets.sheet.id);

  const toggleMoreOptions = useCallback(() => {
    setMoreOptions((old) => !old);
  }, []);

  // gets the validation for the current selection or creates a new one
  useEffect(() => {
    const getValidation = async () => {
      const selection = sheets.getRustSelection();
      let v: Validation | Omit<Validation, 'rule'> | undefined;
      if (showValidation !== 'new') {
        v = await quadraticCore.getValidation(selection);
      }
      if (v) {
        setOriginalValidation(v);
      } else {
        v = {
          id: uuid(),
          selection,
          rule: undefined,
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

        setOriginalValidation(undefined);
      }
      setValidation(v);
    };
    getValidation();
  }, [showValidation]);

  // Used to coerce bigints to numbers for JSON.stringify; see
  // https://github.com/GoogleChromeLabs/jsbi/issues/30#issuecomment-2064279949.
  const bigIntReplacer = (_key: string, value: any): any => {
    return typeof value === 'bigint' ? Number(value) : value;
  };

  const unsaved = useMemo(() => {
    if (originalValidation && validation) {
      return JSON.stringify(originalValidation, bigIntReplacer) !== JSON.stringify(validation, bigIntReplacer);
    }
    return true;
  }, [validation, originalValidation]);

  const rule: ValidationRuleSimple = useMemo(() => {
    if (!validation || !('rule' in validation) || !validation.rule) return '';
    const rule = validation.rule;
    if ('List' in rule) {
      if ('source' in rule.List) {
        if ('List' in rule.List.source) return 'list';
        if ('Selection' in rule.List.source) return 'list-range';
      }
      return 'list';
    } else if ('Logical' in rule) {
      return 'logical';
    }
    throw new Error('Invalid rule in useValidationData');
  }, [validation]);

  const validate = useCallback((): boolean => {
    if (!validation || !('rule' in validation) || !validation.rule) {
      setTriggerError(true);
      return false;
    }

    // if selection is empty, then show error
    if (getSelectionString(validation.selection) === '') {
      setTriggerError(true);
      return false;
    }

    if ('List' in validation.rule) {
      // ensure Selection list is not empty
      if ('List' in validation.rule.List.source) {
        if (validation.rule.List.source.List.length === 0) {
          setTriggerError(true);
          return false;
        }
      }
    }

    // ensure Selection is not empty
    if ('List' in validation.rule) {
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
  const changeRule = useCallback(
    (type: ValidationRuleSimple) => {
      let rule: ValidationRule;
      switch (type) {
        case 'list':
          rule = { List: { source: { List: [] }, ignore_blank: true, drop_down: true } };
          break;

        case 'list-range':
          rule = {
            List: {
              source: {
                Selection: {
                  sheet_id: { id: sheetId },
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

        case 'logical':
          rule = { Logical: { show_checkbox: true, ignore_blank: true } };
          break;

        default:
          throw new Error('Invalid rule type in useValidationData.changeRule');
      }
      setValidation((old) => {
        if (old) {
          return { ...old, rule };
        }
      });
    },
    [sheetId]
  );

  const showDropdown = useMemo(() => {
    if (!validation || !('rule' in validation) || !validation.rule) return false;
    const rule = validation.rule;
    if ('List' in rule) {
      if ('drop_down' in rule.List) {
        return rule.List.drop_down;
      }
    }
    return false;
  }, [validation]);

  const changeDropDown = (checked: boolean) => {
    setValidation((old) => {
      if (old && 'rule' in old) {
        if ('List' in old.rule) {
          return { ...old, rule: { List: { ...old.rule.List, drop_down: checked } } };
        }
      }
    });
  };

  const ignoreBlank = useMemo(() => {
    if (!validation || !('rule' in validation) || !validation.rule) return false;
    const rule = validation?.rule;
    if ('List' in rule) {
      if ('ignore_blank' in rule.List) {
        return rule.List.ignore_blank;
      }
    } else if ('Logical' in rule) {
      if ('ignore_blank' in rule.Logical) {
        return rule.Logical.ignore_blank;
      }
    }
    return false;
  }, [validation]);

  const changeIgnoreBlank = (checked: boolean) => {
    setValidation((old) => {
      if (old && 'rule' in old) {
        if ('List' in old.rule) {
          return { ...old, rule: { List: { ...old.rule.List, ignore_blank: checked } } };
        } else if ('Logical' in old.rule) {
          return { ...old, rule: { Logical: { ...old.rule.Logical, ignore_blank: checked } } };
        }
      }
    });
  };

  // Set the selection for the validation. Note: we use Selection: { x, y,
  // sheet_id, ..default } to indicate that the Selection is blank.
  const setSelection = (selection: Selection | undefined) => {
    if (!selection) {
      setValidation((old) => {
        if (old) {
          return {
            ...old,
            selection: {
              sheet_id: { id: sheets.sheet.id },
              x: BigInt(0),
              y: BigInt(0),
              all: false,
              columns: null,
              rows: null,
              rects: null,
            },
          };
        }
      });
    } else {
      setValidation((old) => {
        if (old) {
          return { ...old, selection };
        }
      });
    }
  };

  const showCheckbox = useMemo(() => {
    if (!validation || !('rule' in validation) || !validation.rule) return false;
    const rule = validation.rule;
    if ('Logical' in rule) {
      return rule.Logical.show_checkbox;
    }
    return false;
  }, [validation]);

  const changeShowCheckbox = (checked: boolean) => {
    setValidation((old) => {
      if (old && 'rule' in old) {
        if ('Logical' in old.rule) {
          return { ...old, rule: { Logical: { show_checkbox: checked } } };
        }
      }
    });
  };

  return {
    validate,
    unsaved,
    validation,
    rule,
    setValidation,
    setSelection,
    showDropdown,
    changeDropDown,
    showCheckbox,
    changeShowCheckbox,
    ignoreBlank,
    changeIgnoreBlank,
    changeRule,
    moreOptions,
    toggleMoreOptions,
    triggerError,
    sheetId,
  };
};