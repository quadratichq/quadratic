import type { ValidationData } from '@/app/ui/menus/Validations/Validation/useValidationData';
import { useValidationDateTimeData } from '@/app/ui/menus/Validations/Validation/ValidationDateTime/useValidationDateTime';
import { ValidationsDateEquals } from '@/app/ui/menus/Validations/Validation/ValidationDateTime/ValidationDateEquals';
import { ValidationDateRanges } from '@/app/ui/menus/Validations/Validation/ValidationDateTime/ValidationDateRanges';
import { ValidationDateTimeRequire } from '@/app/ui/menus/Validations/Validation/ValidationDateTime/ValidationDateTimeRequire';
import { ValidationsTimeEquals } from '@/app/ui/menus/Validations/Validation/ValidationDateTime/ValidationTimeEquals';
import { ValidationTimeRanges } from '@/app/ui/menus/Validations/Validation/ValidationDateTime/ValidationTimeRanges';
import {
  ValidationMoreOptions,
  ValidationUICheckbox,
} from '@/app/ui/menus/Validations/Validation/ValidationUI/ValidationUI';

interface Props {
  validationData: ValidationData;
  onEnter: () => void;
}

export const ValidationDateTime = (props: Props) => {
  const { validationData, onEnter } = props;
  const { ignoreBlank, changeIgnoreBlank, readOnly } = validationData;
  const dateTimeData = useValidationDateTimeData(validationData);

  return (
    // tabIndex allows the calendar to close when clicking outside it
    <div className="flex w-full flex-col gap-5" tabIndex={0}>
      <ValidationUICheckbox
        label="Allow blank values"
        value={ignoreBlank}
        changeValue={changeIgnoreBlank}
        readOnly={readOnly}
      />

      <div>
        <ValidationDateTimeRequire dateTimeData={dateTimeData} />
        <ValidationsDateEquals dateTimeData={dateTimeData} onEnter={onEnter} />
        <ValidationDateRanges dateTimeData={dateTimeData} onEnter={onEnter} />
        <ValidationsTimeEquals dateTimeData={dateTimeData} onEnter={onEnter} />
        <ValidationTimeRanges dateTimeData={dateTimeData} onEnter={onEnter} />
      </div>

      <ValidationMoreOptions validationData={validationData} />
    </div>
  );
};
