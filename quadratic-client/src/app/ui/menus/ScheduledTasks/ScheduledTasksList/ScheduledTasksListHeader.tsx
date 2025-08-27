import { useShowScheduledTasks } from '@/jotai/scheduledTasksAtom';
import { CloseIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';

export const ScheduledTasksListHeader = () => {
  const { closeScheduledTasks } = useShowScheduledTasks();

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-2">
        <span className="flex items-center text-sm font-bold">Scheduled Tasks</span>
      </div>

      <div className="flex items-center gap-2">
        <TooltipPopover label="Close" side="bottom">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={closeScheduledTasks}
          >
            <CloseIcon />
          </Button>
        </TooltipPopover>
      </div>
    </div>
  );
};
