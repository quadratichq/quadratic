import { editorInteractionStateShowValidationAtom } from '@/app/atoms/editorInteractionStateAtom';
import { SheetRange } from '@/app/ui/components/SheetRange';
import { useValidationData } from '@/app/ui/menus/Validations/Validation/useValidationData';
import { ValidationDateTime } from '@/app/ui/menus/Validations/Validation/ValidationDateTime/ValidationDateTime';
import { ValidationHeader } from '@/app/ui/menus/Validations/Validation/ValidationHeader';
import { ValidationList } from '@/app/ui/menus/Validations/Validation/ValidationList';
import { ValidationLogical } from '@/app/ui/menus/Validations/Validation/ValidationLogical';
import { ValidationMessage } from '@/app/ui/menus/Validations/Validation/ValidationMessage';
import { ValidationNone } from '@/app/ui/menus/Validations/Validation/ValidationNone';
import { ValidationNumber } from '@/app/ui/menus/Validations/Validation/ValidationNumber';
import { ValidationText } from '@/app/ui/menus/Validations/Validation/ValidationText';
import type { ValidationRuleSimple } from '@/app/ui/menus/Validations/Validation/validationType';
import { ValidationDropdown } from '@/app/ui/menus/Validations/Validation/ValidationUI/ValidationUI';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Button } from '@/shared/shadcn/ui/button';
import { useCallback, useEffect, useState } from 'react';
import { useSetRecoilState } from 'recoil';

const CRITERIA_OPTIONS: { value: ValidationRuleSimple; label: string }[] = [
  { value: 'none', label: 'Message only' },
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'list', label: 'Values from user list (dropdown)' },
  { value: 'list-range', label: 'Values from sheet (dropdown)' },
  { value: 'logical', label: 'Logical (checkbox)' },
  { value: 'date', label: 'Date and time' },
];

export const Validation = () => {
  const setShowValidation = useSetRecoilState(editorInteractionStateShowValidationAtom);

  const validationData = useValidationData();
  const { rule, changeRule, moreOptions, validation, triggerError, setSelection, sheetId, readOnly, applyValidation } =
    validationData;

  const removeValidation = useCallback(() => {
    if (validation) {
      quadraticCore.removeValidation(sheetId, validation.id);
    }
    setShowValidation(true);
  }, [setShowValidation, sheetId, validation]);

  const [enterTrigger, setEnterTrigger] = useState(false);
  useEffect(() => {
    if (enterTrigger) {
      applyValidation();
      setEnterTrigger(false);
    }
  }, [applyValidation, enterTrigger]);
  const onEnter = useCallback(() => setEnterTrigger(true), []);

  return (
    <div
      className="border-gray relative flex h-full flex-col border-l bg-background px-3 py-1 text-sm"
      style={{ width: '30rem' }}
    >
      <ValidationHeader validationData={validationData} />

      <div className="flex flex-grow flex-col gap-5 overflow-y-auto p-1">
        <SheetRange
          label="Apply to range"
          initial={validation?.selection}
          onChangeSelection={setSelection}
          triggerError={triggerError}
          changeCursor={true}
          readOnly={readOnly}
          onEnter={onEnter}
          onlyCurrentSheet={sheetId}
          onlyCurrentSheetError="Range must be on the same sheet"
        />
        <ValidationDropdown
          label="Criteria"
          value={rule}
          onChange={(value) => changeRule(value as ValidationRuleSimple)}
          options={CRITERIA_OPTIONS}
          readOnly={readOnly}
        />
        {rule === 'none' && <ValidationNone validationData={validationData} onEnter={onEnter} />}
        {(rule === 'list-range' || rule === 'list') && (
          <ValidationList validationData={validationData} onEnter={onEnter} />
        )}
        {rule === 'logical' && <ValidationLogical validationData={validationData} />}
        {rule === 'text' && <ValidationText validationData={validationData} onEnter={onEnter} />}
        {rule === 'number' && <ValidationNumber validationData={validationData} onEnter={onEnter} />}
        {rule === 'date' && <ValidationDateTime validationData={validationData} onEnter={onEnter} />}
        {moreOptions && validationData.rule !== 'none' && (
          <ValidationMessage validationData={validationData} onEnter={onEnter} />
        )}
      </div>

      <div className="mt-3 flex w-full border-t border-t-gray-100 pt-2">
        <div className="mx-auto my-1 flex gap-3">
          {!readOnly && (
            <Button variant="secondary" onClick={removeValidation}>
              Remove Rule
            </Button>
          )}
          <Button onClick={() => applyValidation()}>Done</Button>
        </div>
      </div>
    </div>
  );
};
