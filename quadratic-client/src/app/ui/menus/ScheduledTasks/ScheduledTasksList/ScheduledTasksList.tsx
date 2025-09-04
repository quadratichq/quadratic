import { sheets } from '@/app/grid/controller/Sheets';
import { scheduledTaskDecode } from '@/app/quadratic-core/quadratic_core';
import { ScheduledTasksListHeader } from '@/app/ui/menus/ScheduledTasks/ScheduledTasksList/ScheduledTasksListHeader';
import { CronToListEntry } from '@/app/ui/menus/ScheduledTasks/useCronInterval';
import { scheduledTasksAtom, useScheduledTasks } from '@/jotai/scheduledTasksAtom';
import { ScheduledTasksIcon } from '@/shared/components/Icons';
import { DOCUMENTATION_SCHEDULED_TASKS_URL } from '@/shared/constants/urls';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { useAtomValue } from 'jotai';

export const ScheduledTasksList = () => {
  const scheduledTasks = useAtomValue(scheduledTasksAtom);

  const isEmpty = scheduledTasks.tasks.length === 0;

  return (
    <div
      className="border-gray relative flex h-full shrink-0 flex-col border-l bg-background px-3 text-sm"
      style={{ width: '20rem' }}
      data-testid="scheduled-tasks-panel"
    >
      <ScheduledTasksListHeader />

      {isEmpty && <EmptyScheduledTaskList />}
      {!isEmpty && <ScheduledTaskListBody />}
    </div>
  );
};

const EmptyScheduledTaskList = () => {
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <ScheduledTasksIcon size="lg" />
      <div className="font-bold text-muted-foreground">No scheduled tasks</div>
      <div className="mx-2 mt-1 text-muted-foreground">
        Schedule a task to run automatically at an interval on Quadratic's servers.{' '}
        <a className="underline" href={DOCUMENTATION_SCHEDULED_TASKS_URL}>
          Learn More.
        </a>
      </div>
    </div>
  );
};

const ScheduledTaskName = ({ className, operations }: { className: string; operations: number[] }) => {
  try {
    const decoded = scheduledTaskDecode(new Uint8Array(operations));
    if (!decoded) {
      return <div className={cn('bold', className)}>Run entire file</div>;
    }
    if (decoded.isAllSelected()) {
      return (
        <div className={cn('bold block text-left', className)}>
          Run <span className="font-normal">'{decoded.getSheetName(sheets.jsA1Context)}'</span>
        </div>
      );
    } else {
      return (
        <div className={cn('block text-left', className)}>
          <div className="bold">
            Run <span className="font-normal">{decoded.toA1String(undefined, sheets.jsA1Context)}</span>
          </div>
        </div>
      );
    }
  } catch (e) {
    console.error('Error decoding scheduled task', e);
    return null;
  }
};

const ScheduledTaskListBody = () => {
  const { scheduledTasks, showScheduledTasks } = useScheduledTasks();

  return (
    <div className="flex flex-col gap-3">
      {scheduledTasks.tasks.map((task, i) => {
        return (
          <Button
            key={task.uuid}
            className="flex h-fit items-start justify-between"
            variant="outline"
            onClick={() => showScheduledTasks(task.uuid)}
            autoFocus={i === 0}
          >
            <ScheduledTaskName className="block flex-grow text-left" operations={task.operations} />
            <CronToListEntry className="block w-[100px] shrink-0 text-left" cron={task.cronExpression} />
          </Button>
        );
      })}
    </div>
  );
};
