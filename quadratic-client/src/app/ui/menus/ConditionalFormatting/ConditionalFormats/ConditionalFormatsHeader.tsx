import { editorInteractionStateShowConditionalFormatAtom } from '@/app/atoms/editorInteractionStateAtom';
import { focusGrid } from '@/app/helpers/focusGrid';
import { CloseIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { useSetRecoilState } from 'recoil';

export const ConditionalFormatsHeader = () => {
  const setShowConditionalFormat = useSetRecoilState(editorInteractionStateShowConditionalFormatAtom);

  return (
    <div className="flex items-center justify-between border-b border-b-gray-100 pb-2 pt-3">
      <h2 className="font-semibold">Conditional Formatting</h2>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => {
          setShowConditionalFormat(false);
          focusGrid();
        }}
      >
        <CloseIcon />
      </Button>
    </div>
  );
};
