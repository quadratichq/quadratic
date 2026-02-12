import { editorInteractionStateShowValidationAtom } from '@/app/atoms/editorInteractionStateAtom';
import { focusGrid } from '@/app/helpers/focusGrid';
import type { ValidationData } from '@/app/ui/menus/Validations/Validation/useValidationData';
import { ArrowBackIcon, CloseIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { useSetRecoilState } from 'recoil';

export const ValidationHeader = (props: { validationData: ValidationData }) => {
  const { validation } = props.validationData;
  const setShowValidation = useSetRecoilState(editorInteractionStateShowValidationAtom);
  const isNew = !validation;

  return (
    <div className="flex items-center justify-between border-b border-b-gray-100 pb-2 pt-3">
      <div className="flex items-center gap-1">
        <TooltipPopover label="Back to list" side="bottom">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              setShowValidation(true);
            }}
          >
            <ArrowBackIcon />
          </Button>
        </TooltipPopover>
        <h2 className="font-semibold">{isNew ? 'New Data Validation' : 'Edit Data Validation'}</h2>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => {
          setShowValidation(false);
          focusGrid();
        }}
      >
        <CloseIcon />
      </Button>
    </div>
  );
};
