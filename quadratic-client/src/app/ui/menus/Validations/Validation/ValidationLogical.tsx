import { ValidationData } from './useValidationData';
import { ValidationMoreOptions, ValidationUICheckbox } from './ValidationUI';

interface Props {
  validationData: ValidationData;
}

export const ValidationLogical = (props: Props) => {
  const { ignoreBlank, changeIgnoreBlank, showCheckbox, changeShowCheckbox } = props.validationData;

  return (
    <div className="flex flex-col gap-5">
      {' '}
      <ValidationUICheckbox label="Show checkbox" value={showCheckbox} changeValue={changeShowCheckbox} />
      <ValidationUICheckbox label="Ignore blank values" value={ignoreBlank} changeValue={changeIgnoreBlank} />
      <ValidationMoreOptions validationData={props.validationData} />
    </div>
  );
};
