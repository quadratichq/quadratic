import { NewFileIcon } from '@/dashboard/components/CustomRadixIcons';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
/**
 * This is only done on the app-side
 */
export const useSchemaBrowserTableQueryActionNewFile = () => {
  // Create a new file

  return {
    tableQueryAction: (query: string) => (
      <TooltipPopover label="Create a new file querying this table">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => {
            // TODO: (jimniels) implement this
            alert('Create a new file');
          }}
        >
          <NewFileIcon />
        </Button>
      </TooltipPopover>
    ),
  };
};
