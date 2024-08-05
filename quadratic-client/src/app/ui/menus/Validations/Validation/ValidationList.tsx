import { ValidationData } from './useValidationData';
import { useMemo } from 'react';
import { ValidationUICheckbox, ValidationMoreOptions, ValidationInput } from './ValidationUI';
import { defaultSelection } from '@/app/grid/sheet/selection';
import { Selection, ValidationRule } from '@/app/quadratic-core-types';
import { SheetRange } from '@/app/ui/components/SheetRange';
import { sheets } from '@/app/grid/controller/Sheets';

interface Props {
  validationData: ValidationData;
}

export const ValidationListInput = (props: Props) => {
  const { setValidation, validation, triggerError } = props.validationData;

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
    />
  );
};

export const ValidationList = (props: Props) => {
  const {
    setValidation,
    rule,
    ignoreBlank,
    changeIgnoreBlank,
    showUI: showDropdown,
    changeShowUI: changeDropDown,
    triggerError,
    sheetId,
  } = props.validationData;

  const changeSelection = (selection: Selection | undefined) => {
    console.log(selection);
    const rule: ValidationRule = {
      List: {
        source: { Selection: selection ?? defaultSelection(sheets.sheet.id) },
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
          onChangeSelection={changeSelection}
          triggerError={triggerError}
          changeCursor={sheetId}
        />
      )}
      {rule === 'list' && <ValidationListInput validationData={props.validationData} />}

      <ValidationUICheckbox label="Ignore blank values" value={ignoreBlank} changeValue={changeIgnoreBlank} />
      <ValidationUICheckbox label="Show dropdown in cell" value={showDropdown} changeValue={changeDropDown} />

      <ValidationMoreOptions validationData={props.validationData} />
    </div>
  );
};
