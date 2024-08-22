import { ValidationData } from './useValidationData';
import { ValidationMessage } from './ValidationMessage';

interface Props {
  validationData: ValidationData;
  onEnter?: () => void;
}

export const ValidationNone = (props: Props) => {
  const { onEnter } = props;

  return <ValidationMessage onlyMessage validationData={props.validationData} onEnter={onEnter} />;
};
