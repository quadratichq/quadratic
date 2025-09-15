import GoTo from '@/app/ui/menus/GoTo';
import { TableIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/shadcn/ui/popover';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { trackEvent } from '@/shared/utils/analyticsEvents';

export function AIUserMessageFormSheetButton({
  disabled,
  textareaRef,
}: {
  disabled: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <Popover>
      <TooltipPopover label="Add sheet data">
        <PopoverTrigger asChild>
          <Button
            size="icon-sm"
            className="h-7 w-7 rounded-full px-0 shadow-none hover:bg-border"
            variant="ghost"
            disabled={disabled}
            onClick={() => {
              trackEvent('[AIConnectionsPicker].show');
            }}
          >
            <TableIcon className="" />
          </Button>
        </PopoverTrigger>
      </TooltipPopover>

      <PopoverContent
        side="top"
        alignOffset={0}
        className="w-96 p-0"
        align="start"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <GoTo reverse />
      </PopoverContent>
    </Popover>
  );
}
