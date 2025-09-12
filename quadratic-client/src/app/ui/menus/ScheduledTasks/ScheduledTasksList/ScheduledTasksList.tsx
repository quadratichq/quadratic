import { sheets } from '@/app/grid/controller/Sheets';
import { scheduledTaskDecode } from '@/app/quadratic-core/quadratic_core';
import { getCronToListEntry } from '@/app/ui/menus/ScheduledTasks/useCronInterval';
import { scheduledTasksAtom, useScheduledTasks } from '@/jotai/scheduledTasksAtom';
import { ArrowRightIcon, ScheduledTasksIcon } from '@/shared/components/Icons';
import { DOCUMENTATION_SCHEDULED_TASKS_URL } from '@/shared/constants/urls';
import { Button } from '@/shared/shadcn/ui/button';
import { useAtomValue } from 'jotai';

export const ScheduledTasksList = () => {
  const scheduledTasks = useAtomValue(scheduledTasksAtom);

  const isEmpty = scheduledTasks.tasks.length === 0;

  return isEmpty ? <EmptyScheduledTasksList /> : <ScheduledTasksListBody />;
};

const EmptyScheduledTasksList = () => {
  const { newScheduledTask } = useScheduledTasks();
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <ScheduledTasksIcon size="lg" className="mb-4 text-muted-foreground" />
      <h4 className="font-bold">No scheduled tasks</h4>
      <p className="mt-1 text-muted-foreground">
        Schedule a task to run automatically at an interval on Quadratic's servers.{' '}
        <a className="underline" href={DOCUMENTATION_SCHEDULED_TASKS_URL}>
          Learn more.
        </a>
      </p>
      <Button className="mt-4" onClick={() => newScheduledTask()}>
        Schedule a task
      </Button>
    </div>
  );
};

const getScheduledTaskName = ({ className, operations }: { className: string; operations: number[] }) => {
  try {
    const decoded = scheduledTaskDecode(new Uint8Array(operations));

    if (!decoded) {
      return 'Run file';
    }
    if (decoded.isAllSelected()) {
      return `Run '${decoded.getSheetName(sheets.jsA1Context)}'`;
    } else {
      return `Run ${decoded.toA1String(undefined, sheets.jsA1Context)}`;
    }
  } catch (e) {
    console.error('Error decoding scheduled task', e);
    return '';
  }
};

const ScheduledTasksListBody = () => {
  const { scheduledTasks, showScheduledTasks } = useScheduledTasks();

  return (
    <div className="flex flex-col overflow-y-auto px-4 pb-2">
      {scheduledTasks.tasks.map((task, i) => {
        return (
          <button
            key={task.uuid}
            className="relative -mx-2 flex h-fit flex-col items-start justify-between rounded px-2 py-2 hover:bg-accent"
            onClick={() => showScheduledTasks(task.uuid)}
            autoFocus={i === 0}
          >
            <span className="font-medium">
              {getScheduledTaskName({ className: 'block flex-grow text-left', operations: task.operations })}
            </span>
            <span className="w-10/12 truncate text-left text-xs text-muted-foreground">
              {getCronToListEntry(task.cronExpression)}
            </span>

            <ArrowRightIcon className="absolute right-3 top-2 mt-2 text-muted-foreground opacity-50" />
          </button>
        );
      })}
    </div>
  );
};
