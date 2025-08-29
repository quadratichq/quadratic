import { ScheduledTask } from '@/app/ui/menus/ScheduledTasks/ScheduledTask/ScheduledTask';
import { ScheduledTasksList } from '@/app/ui/menus/ScheduledTasks/ScheduledTasksList/ScheduledTasksList';
import { useScheduledTasks } from '@/jotai/scheduledTasksAtom';

export const ScheduledTasks = () => {
  const { show, currentTask, closeScheduledTasks } = useScheduledTasks();

  if (!show) {
    return null;
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      closeScheduledTasks();
    }
  };

  return (
    <div onKeyDown={handleKeyDown} tabIndex={0}>
      {currentTask && <ScheduledTask />}
      {!currentTask && <ScheduledTasksList />}
    </div>
  );
};
