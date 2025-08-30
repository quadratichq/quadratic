import { ScheduledTasksListHeader } from '@/app/ui/menus/ScheduledTasks/ScheduledTasksList/ScheduledTasksListHeader';
import { scheduledTasksAtom, useScheduledTasks } from '@/jotai/scheduledTasksAtom';
import { ScheduledTasksIcon } from '@/shared/components/Icons';
import { joinListWith } from '@/shared/components/JointListWith';
import { DOCUMENTATION_SCHEDULED_TASKS_URL } from '@/shared/constants/urls';
import { Button } from '@/shared/shadcn/ui/button';
import { useAtomValue } from 'jotai';
import type { JSX } from 'react';

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

const convertDays = (days: number[] | null, time: string | null): JSX.Element => {
  // need to convert the time string from GMT to local time
  const timeParts = time?.split(':');
  if (timeParts) {
    const hours = parseInt(timeParts[0]);
    const minutes = parseInt(timeParts[1]);
    const localTime = new Date();
    localTime.setHours(hours);
    localTime.setMinutes(minutes);
    time = localTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const timeDisplay = time ?? '';
  if (!days || days.length === 0)
    return (
      <div className="block text-left">
        <div>Every day</div>
        <div className="text-xs text-muted-foreground">{timeDisplay}</div>
      </div>
    );
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
  return (
    <>
      <div>{joinListWith({ arr: daysString, conjunction: 'and' })}</div>
      <div className="text-xs text-muted-foreground">{timeDisplay}</div>
    </>
  );
};

const ScheduledTaskListBody = () => {
  const { editableScheduledTasks, showScheduledTasks } = useScheduledTasks();

  return (
    <div className="flex flex-col gap-3">
      {editableScheduledTasks.map((task) => {
        let duration: JSX.Element;
        switch (task.every) {
          case 'days':
            duration = convertDays(task.days, task.time);
            break;
          case 'hour':
            duration = (
              <>
                <div>Every hour</div>
                <div>at the {task.minute} minute</div>
              </>
            );
            break;
          case 'minute':
            duration = <div>Every minute</div>;
            break;
        }
        return (
          <Button
            key={task.uuid}
            className="flex h-fit items-center justify-between"
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
