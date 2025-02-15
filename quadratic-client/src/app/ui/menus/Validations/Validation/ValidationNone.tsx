import type { ValidationData } from '@/app/ui/menus/Validations/Validation/useValidationData';
import { ValidationMessage } from '@/app/ui/menus/Validations/Validation/ValidationMessage';

interface Props {
  validationData: ValidationData;
  onEnter?: () => void;
}

export const ValidationNone = (props: Props) => {
  const { onEnter } = props;

  return <ValidationMessage onlyMessage validationData={props.validationData} onEnter={onEnter} />;
};
