import { ValidationHeader } from './ValidationHeader';
import { Button } from '@/shared/shadcn/ui/button';
import { useValidationData, ValidationRuleSimple } from './useValidationData';
import { useMemo } from 'react';
import { ValidationList } from './ValidationList';
import { ValidationMessage } from './ValidationMessage';
import { ValidationDropdown } from './ValidationUI';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { sheets } from '@/app/grid/controller/Sheets';
import { useSetRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { SheetRange } from '@/app/ui/components/SheetRange';
import { ValidationLogical } from './ValidationLogical';

const CRITERIA_OPTIONS: { value: ValidationRuleSimple; label: string }[] = [
  { value: 'list', label: 'Values from user list (dropdown)' },
  { value: 'list-range', label: 'Values from sheet (dropdown)' },
  { value: 'logical', label: 'Logical (checkbox)' },
];

export const Validation = () => {
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);

  const validationData = useValidationData();
  const { rule, changeRule, moreOptions, validation, triggerError, validate, setSelection, sheetId, unsaved } =
    validationData;

  const validationParameters: JSX.Element | null = useMemo(() => {
    switch (rule) {
      case 'list-range':
      case 'list':
        return <ValidationList validationData={validationData} />;
      case 'logical':
        return <ValidationLogical validationData={validationData} />;
    }
    return null;
  }, [rule, validationData]);

  const applyValidation = () => {
    if (validation && 'rule' in validation && validation.rule) {
      if (!validate()) return;
      if (unsaved) {
        quadraticCore.updateValidation(validation, sheets.getCursorPosition());
      }
    }
    setEditorInteractionState((old) => ({
      ...old,
      showValidation: true,
    }));
  };

  const removeValidation = () => {
    if (validation) {
      quadraticCore.removeValidation(sheetId, validation.id, sheets.getCursorPosition());
    }
    setEditorInteractionState((old) => ({
      ...old,
      showValidation: true,
    }));
  };

  return (
    <div
      className="border-gray relative flex h-full flex-col border-l bg-background px-3 py-1 text-sm"
      style={{ width: '30rem' }}
    >
      <ValidationHeader validationData={validationData} />

      <div className="flex flex-grow flex-col gap-5 overflow-y-auto p-1">
        <SheetRange
          label="Apply to Range"
          initial={validation?.selection}
          onChangeSelection={setSelection}
          triggerError={triggerError}
          changeCursor={true}
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
          <Button variant="secondary" onClick={removeValidation}>
            Remove Rule
          </Button>
          <Button onClick={applyValidation}>Done</Button>
        </div>
      </div>
    </div>
  );
};
