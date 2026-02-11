import { editorInteractionStateShowConditionalFormatAtom } from '@/app/atoms/editorInteractionStateAtom';
import { focusGrid } from '@/app/helpers/focusGrid';
import { ArrowBackIcon, CloseIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { useSetRecoilState } from 'recoil';

interface Props {
  isNew: boolean;
}

export const ConditionalFormatHeader = ({ isNew }: Props) => {
  const setShowConditionalFormat = useSetRecoilState(editorInteractionStateShowConditionalFormatAtom);

  return (
    <div className="flex items-center justify-between border-b border-b-gray-100 pb-2 pt-3">
      <div className="flex items-center gap-1">
        <TooltipPopover label="Back to list" side="bottom">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              setShowConditionalFormat(true);
            }}
          >
            <ArrowBackIcon />
          </Button>
        </TooltipPopover>
        <h2 className="font-semibold">{isNew ? 'New rule' : 'Edit rule'}</h2>
      </div>
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
