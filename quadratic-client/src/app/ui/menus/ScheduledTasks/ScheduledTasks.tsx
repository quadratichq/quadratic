import { ScheduledTask } from '@/app/ui/menus/ScheduledTasks/ScheduledTask/ScheduledTask';
import { ScheduledTasksHeader } from '@/app/ui/menus/ScheduledTasks/ScheduledTasksHeader';
import { ScheduledTasksList } from '@/app/ui/menus/ScheduledTasks/ScheduledTasksList/ScheduledTasksList';
import { useScheduledTasks } from '@/jotai/scheduledTasksAtom';

export const ScheduledTasks = () => {
  const { show, currentTaskId, closeScheduledTasks } = useScheduledTasks();

  if (!show) {
    return null;
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      closeScheduledTasks();
    }
  };

  return (
    <div
      onKeyDown={handleKeyDown}
      style={{ width: '20rem' }}
      data-testid="scheduled-tasks-panel"
      className="relative flex h-full shrink-0 flex-col border-l border-border bg-background text-sm"
    >
      <ScheduledTasksHeader />
      {currentTaskId ? <ScheduledTask /> : <ScheduledTasksList />}
    </div>
  );
};
