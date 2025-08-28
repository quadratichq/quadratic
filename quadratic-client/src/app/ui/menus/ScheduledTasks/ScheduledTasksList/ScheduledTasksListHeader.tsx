import { useScheduledTasks } from '@/jotai/scheduledTasksAtom';
import { AddIcon, CloseIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';

export const ScheduledTasksListHeader = () => {
  const { closeScheduledTasks, newScheduledTask } = useScheduledTasks();

  return (
    <div className="flex w-full justify-between px-2 py-2">
      <span className="flex items-center text-sm font-bold">Scheduled Tasks</span>

      <div className="flex items-center gap-2">
        <TooltipPopover label="New chat">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={newScheduledTask}
          >
            <AddIcon />
          </Button>
        </TooltipPopover>

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
