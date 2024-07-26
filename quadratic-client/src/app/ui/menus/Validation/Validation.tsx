import { ValidationHeader } from './ValidationHeader';
import { SheetRange } from './SheetRange';
import { Button } from '@/shared/shadcn/ui/button';
import { useValidationData, ValidationRuleSimple } from './useValidationData';

import { useMemo } from 'react';
import { ValidationList } from './ValidationList';
import { ValidationMessage } from './ValidationMessage';
import { ValidationDropdown, ValidationInput } from './ValidationUI';

const CRITERIA_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'list', label: 'Dropdown from List' },
  { value: 'list-range', label: 'Dropdown from Range' },
  { value: 'checkbox', label: 'Checkbox' },
];

export const Validation = () => {
  const validationData = useValidationData();
  const { rule, changeRule, moreOptions, validations } = validationData;

  const changeName = (name: string) => {
    validationData.setValidation((old) => {
      if (old) {
        return { ...old, name };
      }
    });
  };

  const validationParameters: JSX.Element | null = useMemo(() => {
    switch (rule) {
      case 'list-range':
        return <ValidationList validationData={validationData} />;
      case 'list':
        return <ValidationList validationData={validationData} />;
    }
    return null;
  }, [rule, validationData]);

  return (
    <div
      className="border-gray relative flex h-full flex-col border-l bg-background px-3 py-1 text-sm"
      style={{ width: '30rem' }}
    >
      <ValidationHeader validationData={validationData} />

      <div className="flex flex-grow flex-col gap-5 overflow-y-auto">
        <SheetRange label="Apply to Range" initial={validationData.range} onChangeRange={() => 0} />
        {validations.length !== 0 && (
          <ValidationDropdown
            label="Use an existing validation"
            value=""
            options={validations.map((value) => ({ label: value.name, value: value.id }))}
            onChange={() => {}}
          />
        )}
        <ValidationInput label="Name" value={validationData.validation?.name || ''} onChange={changeName} />
        <ValidationDropdown
          label="Criteria"
          value={rule}
          onChange={(value) => changeRule(value as ValidationRuleSimple)}
          options={CRITERIA_OPTIONS}
        />
        {validationParameters}
        {moreOptions && <ValidationMessage validationData={validationData} />}
      </div>

      <div className="mt-3 flex w-full border-t border-t-gray-100 pt-2">
        <div className="mx-auto my-1 flex gap-3">
          <Button variant="secondary">Cancel</Button>
          <Button>Apply</Button>
        </div>
      </div>
    </div>
  );
};
