import { ValidationData } from './useValidationData';
import { ValidationMoreOptions, ValidationUICheckbox } from './ValidationUI';

interface Props {
  validationData: ValidationData;
}

export const ValidationLogical = (props: Props) => {
  const { ignoreBlank, changeIgnoreBlank, showUI, changeShowUI, readOnly } = props.validationData;
  return (
    <div className="flex flex-col gap-5">
      {' '}
      <ValidationUICheckbox label="Show checkbox" value={showUI} changeValue={changeShowUI} readOnly={readOnly} />
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
