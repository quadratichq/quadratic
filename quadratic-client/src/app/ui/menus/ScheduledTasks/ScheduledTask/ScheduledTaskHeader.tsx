import { CREATE_TASK_ID, useScheduledTasks } from '@/jotai/scheduledTasksAtom';
import { ArrowBackIcon, CloseIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';

export const ScheduledTaskHeader = () => {
  const { closeScheduledTasks, showScheduledTasks, scheduledTasks } = useScheduledTasks();

  const isCreate = scheduledTasks.currentTaskId === CREATE_TASK_ID;

  return (
    <div className="mb-3 flex w-full justify-between px-2 py-2">
      <div className="flex items-center gap-2">
        <TooltipPopover label="Back to list">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => showScheduledTasks()}
          >
            <ArrowBackIcon />
          </Button>
        </TooltipPopover>
        <span className="flex items-center text-sm font-bold">{isCreate ? 'New' : 'Edit'} Scheduled Task</span>
      </div>
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
  );
};
