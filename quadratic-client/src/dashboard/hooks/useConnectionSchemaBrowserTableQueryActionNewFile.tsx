import { NewFileIcon } from '@/dashboard/components/CustomRadixIcons';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import mixpanel from 'mixpanel-browser';

/**
 * This is only done on the dashboard-side, not the app-side
 */
export const useConnectionSchemaBrowserTableQueryActionNewFile = () => {
  return {
    tableQueryAction: (query: string) => (
      <TooltipPopover label="Create a new file querying this table">
        <Button
          size="icon-sm"
          variant="ghost"
          className="hover:bg-background"
          onClick={() => {
            mixpanel.track('[Connections].schemaViewer.newFileFromTable');
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
