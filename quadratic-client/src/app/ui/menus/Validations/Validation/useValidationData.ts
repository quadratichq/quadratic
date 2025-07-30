//! Holds current Validation data and provides functions that create or change validations.
//! This is a passed-version of context for the Validation component.

import { hasPermissionToEditFile } from '@/app/actions';
import {
  editorInteractionStatePermissionsAtom,
  editorInteractionStateShowValidationAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { bigIntReplacer } from '@/app/bigint';
import { sheets } from '@/app/grid/controller/Sheets';
import type { ValidationRule, ValidationUpdate } from '@/app/quadratic-core-types';
import type { JsSelection } from '@/app/quadratic-core/quadratic_core';
import type { ValidationRuleSimple, ValidationUndefined } from '@/app/ui/menus/Validations/Validation/validationType';
import { validationRuleSimple, ValidationRuleSimpleValues } from '@/app/ui/menus/Validations/Validation/validationType';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { v4 } from 'uuid';

export type SetState<T> = Dispatch<SetStateAction<T>>;

export interface ValidationData {
  unsaved: boolean;
  validation: ValidationUndefined | undefined;
  rule: ValidationRuleSimple;
  setValidation: SetState<ValidationUndefined | undefined>;
  setSelection: (jsSelection: JsSelection | undefined) => void;
  changeRule: (rule: ValidationRuleSimple) => void;
  showUI: boolean;
  changeShowUI: (checked: boolean) => void;
  ignoreBlank: boolean;
  changeIgnoreBlank: (checked: boolean) => void;
  moreOptions: boolean;
  toggleMoreOptions: () => void;
  validate: () => boolean;
  triggerError: boolean;
  sheetId: string;
  readOnly: boolean;
  applyValidation: () => void;
}

export const useValidationData = (): ValidationData => {
  const [showValidation, setShowValidation] = useRecoilState(editorInteractionStateShowValidationAtom);
  const permissions = useRecoilValue(editorInteractionStatePermissionsAtom);
  const readOnly = !hasPermissionToEditFile(permissions);

  const [validation, setValidation] = useState<ValidationUndefined>();
  const [originalValidation, setOriginalValidation] = useState<ValidationUndefined>();
  const [moreOptions, setMoreOptions] = useState(false);
  const [triggerError, setTriggerError] = useState(false);
  const [sheetId] = useState(sheets.current);

  const toggleMoreOptions = useCallback(() => {
    setMoreOptions((old) => !old);
  }, []);

  const unsaved = useMemo(() => {
    if (originalValidation && validation) {
      return JSON.stringify(originalValidation, bigIntReplacer) !== JSON.stringify(validation, bigIntReplacer);
    }
    return true;
  }, [validation, originalValidation]);

  const rule: ValidationRuleSimple = useMemo(() => validationRuleSimple(validation), [validation]);

  // Validates the input against the current validation
  const validate = useCallback((): boolean => {
    if (!validation || !('rule' in validation) || !validation.rule) {
      setTriggerError(true);
      return false;
    }

    if (validation.rule === 'None') {
      return true;
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
          if (!selection.ranges?.length) {
            setTriggerError(true);
            return false;
          }
        }
      }
    }

    return true;
  }, [validation]);

  const applyValidation = useCallback(() => {
    if (!readOnly) {
      if (validation && 'rule' in validation && validation.rule) {
        if (!validate()) return;
        if (unsaved) {
          quadraticCore.updateValidation(validation);
        }
      }
    }
    setShowValidation(true);
  }, [readOnly, setShowValidation, unsaved, validate, validation]);

  // change the rule using the simple rule type; creates a default value for that rule
  const changeRule = useCallback(
    (type: ValidationRuleSimple) => {
      let rule: ValidationRule;
      switch (type) {
        case 'none':
          rule = 'None';
          break;

        case 'number':
          rule = { Number: { ignore_blank: true, ranges: [] } };
          break;

        case 'text':
          rule = { Text: { ignore_blank: true, text_match: [] } };
          break;

        case 'list':
          rule = { List: { source: { List: [] }, ignore_blank: true, drop_down: true } };
          break;

        case 'list-range':
          rule = {
            List: {
              source: {
                Selection: {
                  sheet_id: { id: sheetId },
                  cursor: {
                    x: BigInt(0),
                    y: BigInt(0),
                  },
                  ranges: [],
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

        case 'date':
          rule = {
            DateTime: {
              ignore_blank: true,
              require_date: false,
              require_time: false,
              prohibit_date: false,
              prohibit_time: false,
              ranges: [],
            },
          };
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

  useEffect(() => {
    if (
      typeof showValidation === 'string' &&
      ['text', 'number', 'list', 'list-range', 'logical', 'none'].includes(showValidation)
    ) {
      changeRule(showValidation as ValidationRuleSimple);
    }
  }, [changeRule, showValidation]);

  // Whether the UI shows (eg, checkbox for logical validation; dropdown for
  // list validation)
  const showUI = useMemo(() => {
    if (!validation || !('rule' in validation) || !validation.rule) return false;
    const rule = validation.rule;
    if (rule === 'None') return false;
    if ('List' in rule) {
      if ('drop_down' in rule.List) {
        return rule.List.drop_down;
      }
    } else if ('Logical' in rule) {
      if ('show_checkbox' in rule.Logical) {
        return rule.Logical.show_checkbox;
      }
    }
    return false;
  }, [validation]);

  // Used to change whether the UI shows (eg, checkbox for logical validation;
  // dropdown for list validation)
  const changeShowUI = (checked: boolean) => {
    setValidation((old) => {
      if (old && 'rule' in old) {
        if (old.rule === 'None') return old;
        if ('List' in old.rule) {
          const rule: ValidationUndefined = { ...old, rule: { List: { ...old.rule.List, drop_down: checked } } };
          return rule;
        } else if ('Logical' in old.rule) {
          const rule: ValidationUndefined = {
            ...old,
            rule: { Logical: { ...old.rule.Logical, show_checkbox: checked } },
          };
          return rule;
        }
        return old;
      }
    });
  };

  const ignoreBlank = useMemo(() => {
    if (!validation || !('rule' in validation) || !validation.rule) return false;
    const rule = validation?.rule;
    if (rule === 'None') return false;
    if ('List' in rule) {
      return rule.List.ignore_blank;
    } else if ('Logical' in rule) {
      return rule.Logical.ignore_blank;
    } else if ('Text' in rule) {
      return rule.Text.ignore_blank;
    } else if ('Number' in rule) {
      return rule.Number.ignore_blank;
    } else if ('DateTime' in rule) {
      return rule.DateTime.ignore_blank;
    }
    return false;
  }, [validation]);

  const changeIgnoreBlank = (checked: boolean) => {
    setValidation((old) => {
      if (old && 'rule' in old) {
        if (old.rule === 'None') return old;
        if ('List' in old.rule) {
          return { ...old, rule: { List: { ...old.rule.List, ignore_blank: checked } } };
        }
        if ('Logical' in old.rule) {
          return { ...old, rule: { Logical: { ...old.rule.Logical, ignore_blank: checked } } };
        }
        if ('Text' in old.rule) {
          return { ...old, rule: { Text: { ...old.rule.Text, ignore_blank: checked } } };
        }
        if ('Number' in old.rule) {
          return { ...old, rule: { Number: { ...old.rule.Number, ignore_blank: checked } } };
        }
        if ('DateTime' in old.rule) {
          return { ...old, rule: { DateTime: { ...old.rule.DateTime, ignore_blank: checked } } };
        }
      }
    });
  };

  // Set the selection for the validation. Note: we use Selection: { x, y,
  // sheet_id, ..default } to indicate that the Selection is blank.
  const setSelection = (jsSelection: JsSelection | undefined) => {
    if (!jsSelection) {
      setValidation((old) => {
        if (old) {
          return {
            ...old,
            selection: {
              sheet_id: { id: sheets.current },
              cursor: {
                x: BigInt(0),
                y: BigInt(0),
              },
              ranges: [],
            },
          };
        }
      });
    } else {
      setValidation((old) => {
        if (old) {
          return { ...old, selection: jsSelection.selection() };
        }
      });
    }
  };

  useEffect(() => {
    const getValidation = async () => {
      // showValidation can be a pre-selected rule for a new validation
      let rule: ValidationRuleSimple | undefined = undefined;
      if (typeof showValidation === 'string' && ValidationRuleSimpleValues.includes(showValidation)) {
        rule = showValidation as ValidationRuleSimple;
      }

      // gets the validation for the current selection or creates a new one
      let v: ValidationUpdate | Omit<ValidationUpdate, 'rule'> | undefined;
      if (showValidation && showValidation !== true && showValidation !== 'new' && rule === undefined) {
        v = sheets.getById(sheetId)?.validations.find((v) => v.id === showValidation);
      }
      if (v) {
        setOriginalValidation(v);
      } else {
        v = {
          id: v4(),
          selection: sheets.sheet.cursor.selection(),
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

        setOriginalValidation(undefined);
      }
      setValidation(v);
      if (rule) {
        changeRule(rule);
      }
    };
    getValidation();
  }, [changeRule, sheetId, showValidation]);

  return {
    validate,
    unsaved,
    validation,
    rule,
    setValidation,
    setSelection,
    showUI,
    changeShowUI,
    ignoreBlank,
    changeIgnoreBlank,
    changeRule,
    moreOptions,
    toggleMoreOptions,
    triggerError,
    sheetId,
    readOnly,
    applyValidation,
  };
};
