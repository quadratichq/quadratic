import { editorInteractionStateShowValidationAtom } from '@/app/atoms/editorInteractionStateAtom';
import { Validation } from '@/app/ui/menus/Validations/Validation/Validation';
import { Validations } from '@/app/ui/menus/Validations/Validations/Validations';
import { useRecoilValue } from 'recoil';

export const ValidationPanel = () => {
  const showValidation = useRecoilValue(editorInteractionStateShowValidationAtom);

  if (showValidation === false) {
    return null;
  }

  if (showValidation === true) {
    return <Validations />;
  }

  return <Validation />;
};
