import { ValidationData } from './useValidationData';
import { ValidationMoreOptions, ValidationUICheckbox } from './ValidationUI';

interface Props {
  validationData: ValidationData;
}

export const ValidationCheckbox = (props: Props) => {
  const { ignoreBlank, changeIgnoreBlank, moreOptions } = props.validationData;

  return (
    <div className="flex flex-col gap-5">
      {' '}
      <ValidationMoreOptions validationData={props.validationData} />
      {moreOptions && (
        <ValidationUICheckbox
          label="Ignore blank values"
          showDropdown={ignoreBlank}
          changeDropDown={changeIgnoreBlank}
        />
      )}
    </div>
  );
};
