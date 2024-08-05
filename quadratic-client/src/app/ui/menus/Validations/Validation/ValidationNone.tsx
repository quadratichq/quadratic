import { ValidationData } from './useValidationData';
import { ValidationMessage } from './ValidationMessage';

interface Props {
  validationData: ValidationData;
}

export const ValidationNone = (props: Props) => {
  return <ValidationMessage onlyMessage validationData={props.validationData} />;
};
