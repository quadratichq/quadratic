import { ValidationData } from './useValidationData';
import { useMemo } from 'react';
import { ValidationUICheckbox, ValidationMoreOptions, ValidationInput } from '../ValidationUI';
import { defaultSelection } from '@/app/grid/sheet/selection';
import { Selection, ValidationRule } from '@/app/quadratic-core-types';
import { SheetRange } from '@/app/ui/components/SheetRange';

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
    const rule = validation?.rule;
    if (rule) {
      if (rule === 'None') return '';
      if ('List' in rule) {
        if ('source' in rule.List) {
          if ('List' in rule.List.source) {
            const split = rule.List.source.List;
            if (split.length === 0) return '';
            return split.map((value) => value.trim()).join(', ');
          }
        }
      }
    }
    return '';
  }, [validation?.rule]);

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
    showDropdown,
    changeDropDown,
    moreOptions,
    triggerError,
  } = props.validationData;

  const changeSelection = (selection: Selection | undefined) => {
    const rule: ValidationRule = {
      List: {
        source: { Selection: selection ?? defaultSelection() },
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
        <SheetRange label="Range" onChangeSelection={changeSelection} triggerError={triggerError} />
      )}
      {rule === 'list' && <ValidationListInput validationData={props.validationData} />}

      <ValidationMoreOptions validationData={props.validationData} />

      {moreOptions && (
        <ValidationUICheckbox
          label="Ignore blank values"
          showDropdown={ignoreBlank}
          changeDropDown={changeIgnoreBlank}
        />
      )}
      {moreOptions && (
        <ValidationUICheckbox
          label="Show dropdown in cell"
          showDropdown={showDropdown}
          changeDropDown={changeDropDown}
        />
      )}
    </div>
  );
};
