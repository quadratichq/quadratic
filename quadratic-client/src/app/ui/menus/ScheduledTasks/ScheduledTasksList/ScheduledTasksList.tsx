import { ScheduledTasksListHeader } from '@/app/ui/menus/ScheduledTasks/ScheduledTasksList/ScheduledTasksListHeader';
import { scheduledTasksAtom, useScheduledTasks } from '@/jotai/scheduledTasksAtom';
import { ScheduledTasksIcon } from '@/shared/components/Icons';
import { joinListWith } from '@/shared/components/JointListWith';
import { DOCUMENTATION_SCHEDULED_TASKS_URL } from '@/shared/constants/urls';
import { Button } from '@/shared/shadcn/ui/button';
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

const convertDays = (days: number[] | null, time: string | null) => {
  if (!days || days.length === 0) return `Every day at ${time}`;
  let daysString = [];
  for (const day of days) {
    if (day === 0 || day === 7) {
      daysString.push('Sun');
    } else if (day === 1) {
      daysString.push('Mon');
    } else if (day === 2) {
      daysString.push('Tue');
    } else if (day === 3) {
      daysString.push('Wed');
    } else if (day === 4) {
      daysString.push('Thu');
    } else if (day === 5) {
      daysString.push('Fri');
    } else if (day === 6) {
      daysString.push('Sat');
    }
  }
  return `${joinListWith({ arr: daysString, conjunction: 'and' })} at ${time}`;
};

const ScheduledTaskListBody = () => {
  const { editableScheduledTasks, showScheduledTasks } = useScheduledTasks();

  return (
    <div className="flex flex-col gap-3">
      {editableScheduledTasks.map((task) => {
        let duration = '';
        switch (task.every) {
          case 'days':
            duration = convertDays(task.days, task.time);
            break;
          case 'hour':
            duration = `Every hour at the ${task.minute} minute`;
            break;
          case 'minute':
            duration = 'Every minute';
            break;
        }
        return (
          <Button
            key={task.uuid}
            className="flex items-center justify-between"
            variant="outline"
            onClick={() => showScheduledTasks(task.uuid)}
          >
            <div className="font-bold">Run sheet</div>
            <div className="text-muted-foreground">{duration}</div>
          </Button>
        );
      })}
    </div>
  );
};
