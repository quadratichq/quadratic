import type { ValidationDateTimeData } from '@/app/ui/menus/Validations/Validation/ValidationDateTime/useValidationDateTime';
import { ValidationDropdown } from '@/app/ui/menus/Validations/Validation/ValidationUI/ValidationUI';
import { useCallback } from 'react';

interface Props {
  dateTimeData: ValidationDateTimeData;
}

export const ValidationDateTimeRequire = (props: Props) => {
  const { readOnly, validationDateTime, setValidationDateTime, dateRequire, timeRequire } = props.dateTimeData;

  const changeDateRequire = useCallback(
    (value: string) => {
      setValidationDateTime({
        ...validationDateTime,
        require_date: value === 'required',
        prohibit_date: value === 'prohibit',
      });
    },
    [validationDateTime, setValidationDateTime]
  );

  const changeTimeRequire = useCallback(
    (value: string) => {
      setValidationDateTime({
        ...validationDateTime,
        require_time: value === 'required',
        prohibit_time: value === 'prohibit',
      });
    },
    [setValidationDateTime, validationDateTime]
  );

  return (
    <div className="flex w-full gap-2">
      <ValidationDropdown
        className="w-full"
        label="Date part"
        value={dateRequire}
        onChange={changeDateRequire}
        includeBlank
        options={['required', 'prohibit']}
        readOnly={readOnly}
      />
      <ValidationDropdown
        className="w-full"
        label="Time part"
        value={timeRequire}
        onChange={changeTimeRequire}
        includeBlank
        options={['required', 'prohibit']}
        readOnly={readOnly}
      />
    </div>
  );
};
