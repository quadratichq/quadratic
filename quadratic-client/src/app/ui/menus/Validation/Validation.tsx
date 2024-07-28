import { ValidationHeader } from './ValidationHeader';
import { SheetRange } from './SheetRange';
import { Button } from '@/shared/shadcn/ui/button';
import { useValidationData, ValidationRuleSimple } from './useValidationData';

import { useMemo, useState } from 'react';
import { ValidationList } from './ValidationList';
import { ValidationMessage } from './ValidationMessage';
import { ValidationDropdown, ValidationInput } from './ValidationUI';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { sheets } from '@/app/grid/controller/Sheets';
import { getSelectionRange, parseSelectionRange } from '@/app/grid/sheet/selection';
import { useSetRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { ValidationCheckbox } from './ValidationCheckbox';

const CRITERIA_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'list', label: 'Dropdown from List' },
  { value: 'list-range', label: 'Dropdown from Range' },
  { value: 'checkbox', label: 'Checkbox' },
];

export const Validation = () => {
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);

  const validationData = useValidationData();
  const { rule, changeRule, moreOptions, validation, validations, unsaved, triggerError, validate } = validationData;

  const [range, setRange] = useState(getSelectionRange(sheets.sheet.cursor));

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
      case 'list':
        return <ValidationList validationData={validationData} />;
      case 'checkbox':
        return <ValidationCheckbox validationData={validationData} />;
    }
    return null;
  }, [rule, validationData]);

  const applyValidation = () => {
    if (!validate()) return;

    if (!range || !validation) return;
    const selection = parseSelectionRange(range);
    if (!Array.isArray(selection)) {
      quadraticCore.updateValidation(selection, validation, sheets.getCursorPosition());
    }
    setEditorInteractionState((old) => ({
      ...old,
      showValidation: false,
    }));
  };

  return (
    <div
      className="border-gray relative flex h-full flex-col border-l bg-background px-3 py-1 text-sm"
      style={{ width: '30rem' }}
    >
      <ValidationHeader validationData={validationData} />

      <div className="flex flex-grow flex-col gap-5 overflow-y-auto p-1">
        <SheetRange label="Apply to Range" initial={range} onChangeRange={setRange} triggerError={triggerError} />
        {validations.length !== 0 && (
          <ValidationDropdown
            label="Replace with an existing validation"
            value=""
            options={validations.map((value) => ({ label: value.name, value: value.id }))}
            onChange={() => {}}
          />
        )}
        <ValidationInput
          label="Name"
          value={validationData.validation?.name || ''}
          onChange={changeName}
          error={triggerError && validationData.validation?.name.trim() === '' ? 'Name needs to be defined' : undefined}
        />
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
          <Button disabled={!unsaved || !range} onClick={applyValidation}>
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
};
