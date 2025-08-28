import { ScheduledTasksListHeader } from '@/app/ui/menus/ScheduledTasks/ScheduledTasksList/ScheduledTasksListHeader';
import { scheduledTasksAtom } from '@/jotai/scheduledTasksAtom';
import { ScheduledTasksIcon } from '@/shared/components/Icons';
import { DOCUMENTATION_SCHEDULED_TASKS_URL } from '@/shared/constants/urls';
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
