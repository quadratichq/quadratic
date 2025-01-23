import { sheets } from '@/app/grid/controller/Sheets';
import type { ValidationRule } from '@/app/quadratic-core-types';
import type { JsSelection } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { newSingleSelection } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { SheetRange } from '@/app/ui/components/SheetRange';
import type { ValidationData } from '@/app/ui/menus/Validations/Validation/useValidationData';
import { ValidationInput } from '@/app/ui/menus/Validations/Validation/ValidationUI/ValidationInput';
import {
  ValidationMoreOptions,
  ValidationUICheckbox,
} from '@/app/ui/menus/Validations/Validation/ValidationUI/ValidationUI';
import { useMemo } from 'react';

interface Props {
  validationData: ValidationData;
  onEnter: () => void;
}

export const ValidationListInput = (props: Props) => {
  const { setValidation, validation, triggerError, readOnly } = props.validationData;

  const changeList = (list: string) => {
    const trimmedList = list.split(',').map((value) => value.trim());
    setValidation((old) => {
      if (old) {
        return { ...old, rule: { List: { source: { List: trimmedList }, ignore_blank: true, drop_down: true } } };
      }
    });
  };

  const list = useMemo(() => {
    if (!validation || !('rule' in validation) || validation.rule === 'None') return '';
    const rule = validation.rule;
    if ('List' in rule) {
      if ('source' in rule.List) {
        if ('List' in rule.List.source) {
          const split = rule.List.source.List;
          if (split.length === 0) return '';
          return split.map((value) => value.trim()).join(', ');
        }
      }
    }
    return '';
  }, [validation]);

  return (
    <ValidationInput
      label="List"
      value={list}
      onChange={changeList}
      footer="Enter values separated by commas"
      error={triggerError && list.trim() === '' ? 'Need at least one value in list' : undefined}
      readOnly={readOnly}
    />
  );
};

export const ValidationList = (props: Props) => {
  const { onEnter, validationData } = props;
  const {
    validation,
    setValidation,
    rule,
    ignoreBlank,
    changeIgnoreBlank,
    showUI: showDropdown,
    changeShowUI: changeDropDown,
    triggerError,
    sheetId,
    readOnly,
  } = validationData;

  const selection = useMemo(() => {
    if (!validation || !('rule' in validation)) return;
    const list = validation.rule as ValidationRule;
    if (list === 'None') return;
    if ('List' in list && 'source' in list.List && 'Selection' in list.List.source) {
      return list.List.source.Selection;
    }
  }, [validation]);

  const changeSelection = (jsSelection: JsSelection | undefined) => {
    const rule: ValidationRule = {
      List: {
        source: { Selection: (jsSelection ?? newSingleSelection(sheets.sheet.id, 1, 1)).selection() },
        ignore_blank: ignoreBlank,
        drop_down: showDropdown,
      },
    };
    setValidation((old) => {
      if (old) {
        return {
          ...old,
          rule,
        };
      }
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {rule === 'list-range' && (
        <SheetRange
          label="Range"
          initial={selection}
          onChangeSelection={changeSelection}
          triggerError={triggerError}
          changeCursor={sheetId}
          readOnly={readOnly}
          onEnter={onEnter}
        />
      )}
      {rule === 'list' && <ValidationListInput validationData={props.validationData} onEnter={onEnter} />}

      <ValidationUICheckbox
        label="Allow blank values"
        value={ignoreBlank}
        changeValue={changeIgnoreBlank}
        readOnly={readOnly}
      />
      <ValidationUICheckbox
        label="Show dropdown in cell"
        value={showDropdown}
        changeValue={changeDropDown}
        readOnly={readOnly}
      />

      <ValidationMoreOptions validationData={props.validationData} />
    </div>
  );
};
