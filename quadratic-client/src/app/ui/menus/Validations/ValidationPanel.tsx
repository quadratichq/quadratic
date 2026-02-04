import { editorInteractionStateShowValidationAtom } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { Validation } from '@/app/ui/menus/Validations/Validation/Validation';
import { Validations } from '@/app/ui/menus/Validations/Validations/Validations';
import { useEffect, useRef } from 'react';
import { useRecoilState } from 'recoil';

export const ValidationPanel = () => {
  const [showValidation, setShowValidation] = useRecoilState(editorInteractionStateShowValidationAtom);
  const prevShowRef = useRef(showValidation);

  // Only redirect to 'new' when panel first opens (false -> true) with no validations
  useEffect(() => {
    const wasHidden = prevShowRef.current === false;
    const isNowShowingList = showValidation === true;

    if (wasHidden && isNowShowingList) {
      // Panel just opened - check if there are any validations
      const hasValidations = sheets.sheet.validations.length > 0;
      if (!hasValidations) {
        setShowValidation('new');
      }
    }

    prevShowRef.current = showValidation;
  }, [showValidation, setShowValidation]);

  if (showValidation === false) {
    return null;
  }

  if (showValidation === true) {
    return <Validations />;
  }

  return <Validation />;
};
