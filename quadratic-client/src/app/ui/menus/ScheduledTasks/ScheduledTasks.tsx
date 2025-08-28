import { ScheduledTask } from '@/app/ui/menus/ScheduledTasks/ScheduledTask/ScheduledTask';
import { ScheduledTasksList } from '@/app/ui/menus/ScheduledTasks/ScheduledTasksList/ScheduledTasksList';
import { scheduledTasksAtom } from '@/jotai/scheduledTasksAtom';
import { useAtomValue } from 'jotai';

export const ScheduledTasks = () => {
  const scheduledTasks = useAtomValue(scheduledTasksAtom);

  if (!scheduledTasks.show) {
    return null;
  }

  if (scheduledTasks.currentTaskId) {
    return <ScheduledTask />;
  } else {
    return <ScheduledTasksList />;
  }
};
