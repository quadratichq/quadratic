/* eslint-disable @typescript-eslint/no-unused-vars */
import { Validation, ValidationRule } from '@/app/quadratic-core-types';
import { Label } from '@/shared/shadcn/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/shadcn/ui/select';
import { SetState, ValidationData, ValidationRuleSimple } from './useValidationData';
import { useMemo } from 'react';

interface Props {
  validationData: ValidationData;
}

export const ValidationCriteria = (props: Props) => {
  const { validation, setValidation, validationRule, rule } = props.validationData;

  const onSelect = (value: ValidationRuleSimple) => {
    const updateValidation = (validationRule: ValidationRule) => {
      setValidation((old) => {
        if (old) {
          return { ...old, rule: validationRule };
        }
      });
    };

    switch (value) {
      case 'none':
        updateValidation(validationRule('none'));
        break;

      case 'list':
        updateValidation(validationRule('list'));
        break;

      case 'list-range':
        updateValidation(validationRule('list-range'));
        break;

      default:
        throw new Error('Invalid onSelect value in ValidationCriteria');
    }
  };

  return (
    <div>
      <Label htmlFor="validation-criteria">Criteria</Label>
      <Select value={rule} onValueChange={onSelect}>
        <SelectTrigger>
          <SelectValue placeholder="None" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          <SelectItem value="list">Dropdown from List</SelectItem>
          <SelectItem value="list-range">Dropdown from Range</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
