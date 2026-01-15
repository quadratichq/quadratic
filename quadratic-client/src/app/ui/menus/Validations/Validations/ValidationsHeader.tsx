import { editorInteractionStateShowValidationAtom } from '@/app/atoms/editorInteractionStateAtom';
import { focusGrid } from '@/app/helpers/focusGrid';
import { CloseIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { useSetRecoilState } from 'recoil';

export const ValidationsHeader = () => {
  const setShowValidation = useSetRecoilState(editorInteractionStateShowValidationAtom);

  return (
    <div className="flex items-center justify-between border-b border-b-gray-100 pb-2 pt-3">
      <h2 className="font-semibold">Data Validations</h2>
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
