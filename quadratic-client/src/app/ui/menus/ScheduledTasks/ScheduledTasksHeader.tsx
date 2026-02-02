// Header for the ScheduledTasks component.

import { CREATE_TASK_ID, useScheduledTasks } from '@/jotai/scheduledTasksAtom';
import { AddIcon, ArrowBackIcon, CloseIcon } from '@/shared/components/Icons';
import { useFileRouteLoaderDataRequired } from '@/shared/hooks/useFileRouteLoaderData';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';

type View = 'create' | 'list' | 'details';

export const ScheduledTasksHeader = () => {
  const {
    userMakingRequest: { teamPermissions },
  } = useFileRouteLoaderDataRequired();
  const { closeScheduledTasks, showScheduledTasks, scheduledTasks, newScheduledTask } = useScheduledTasks();

  const view: View =
    scheduledTasks.currentTaskId === null
      ? 'list'
      : scheduledTasks.currentTaskId === CREATE_TASK_ID
        ? 'create'
        : 'details';

  return (
    <div className="relative flex h-12 w-full flex-shrink-0 items-center justify-between px-4">
      {view !== 'list' && (
        <TooltipPopover label="Back">
          <Button
            variant="ghost"
            size="icon-sm"
            className="-ml-2 mr-1 text-muted-foreground hover:text-foreground"
            onClick={() => showScheduledTasks()}
          >
            <ArrowBackIcon />
          </Button>
        </TooltipPopover>
      )}
      <h3 className="flex flex-grow items-center gap-2 text-sm font-semibold">
        {view === 'list' ? 'Scheduled tasks' : view === 'create' ? 'New scheduled task' : 'Edit scheduled task'}
      </h3>
      <div className="flex items-center gap-1">
        {view === 'list' && teamPermissions?.includes('TEAM_EDIT') && (
          <TooltipPopover label="New">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={newScheduledTask}
            >
              <AddIcon />
            </Button>
          </TooltipPopover>
        )}
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
      <hr className="absolute bottom-0 left-0 right-0 hidden h-px border-t border-border" />
    </div>
  );
};
