import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { useRecoilValue } from 'recoil';
import { Validations } from './Validations/Validations';
import { Validation } from './Validation/Validation';

export const ValidationPanel = () => {
  const { showValidation } = useRecoilValue(editorInteractionStateAtom);

  if (showValidation === false) {
    return null;
  }

  if (showValidation === true) {
    return <Validations />;
  }

  return <Validation validationId={showValidation} />;
};
