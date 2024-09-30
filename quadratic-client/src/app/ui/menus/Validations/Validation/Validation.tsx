import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { SheetRange } from '@/app/ui/components/SheetRange';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Button } from '@/shared/shadcn/ui/button';
import { useCallback, useEffect, useState } from 'react';
import { useSetRecoilState } from 'recoil';
import { useValidationData } from './useValidationData';
import { ValidationDateTime } from './ValidationDateTime/ValidationDateTime';
import { ValidationHeader } from './ValidationHeader';
import { ValidationList } from './ValidationList';
import { ValidationLogical } from './ValidationLogical';
import { ValidationMessage } from './ValidationMessage';
import { ValidationNone } from './ValidationNone';
import { ValidationNumber } from './ValidationNumber';
import { ValidationText } from './ValidationText';
import { ValidationRuleSimple } from './validationType';
import { ValidationDropdown } from './ValidationUI/ValidationUI';

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
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);

  const validationData = useValidationData();
  const { rule, changeRule, moreOptions, validation, triggerError, setSelection, sheetId, readOnly, applyValidation } =
    validationData;

  const removeValidation = () => {
    if (validation) {
      quadraticCore.removeValidation(sheetId, validation.id, sheets.getCursorPosition());
    }
    setEditorInteractionState((old) => ({
      ...old,
      showValidation: true,
    }));
  };

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
