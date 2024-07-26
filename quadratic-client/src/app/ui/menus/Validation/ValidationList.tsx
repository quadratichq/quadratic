import { SheetRange } from './SheetRange';
import { ValidationData } from './useValidationData';
import { useMemo } from 'react';
import { ValidationCheckbox, ValidationMoreOptions, ValidationInput } from './ValidationUI';

interface Props {
  validationData: ValidationData;
}

export const ValidationListInput = (props: Props) => {
  const { setValidation, validation } = props.validationData;
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

  return <ValidationInput label="List" value={list} onChange={changeList} footer="Enter values separated by commas" />;
};

export const ValidationList = (props: Props) => {
  const { rule, ignoreBlank, changeIgnoreBlank, showDropdown, changeDropDown, moreOptions } = props.validationData;

  return (
    <div className="flex flex-col gap-5">
      {rule === 'list-range' && <SheetRange label="Range" onChangeRange={() => 0} />}
      {rule === 'list' && <ValidationListInput validationData={props.validationData} />}

      <ValidationMoreOptions validationData={props.validationData} />

      {moreOptions && (
        <ValidationCheckbox label="Ignore blank values" showDropdown={ignoreBlank} changeDropDown={changeIgnoreBlank} />
      )}
      {moreOptions && (
        <ValidationCheckbox label="Show dropdown in cell" showDropdown={showDropdown} changeDropDown={changeDropDown} />
      )}
    </div>
  );
};
