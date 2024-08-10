import { ValidationData } from './useValidationData';
import { ValidationMoreOptions, ValidationUICheckbox } from './ValidationUI';

interface Props {
  validationData: ValidationData;
}

export const ValidationNumber = (props: Props) => {
  const { ignoreBlank, changeIgnoreBlank, readOnly } = props.validationData;
  return (
    <div className="flex flex-col gap-5">
      {' '}
      <ValidationUICheckbox
        label="Allow blank values"
        value={ignoreBlank}
        changeValue={changeIgnoreBlank}
        readOnly={readOnly}
      />
      <ValidationMoreOptions validationData={props.validationData} />
    </div>
  );
};
