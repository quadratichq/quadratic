import { ScheduledTasksListHeader } from '@/app/ui/menus/ScheduledTasks/ScheduledTasksList/ScheduledTasksListHeader';

export const ScheduledTasksList = () => {
  return (
    <div
      className="border-gray relative flex h-full shrink-0 flex-col border-l bg-background px-3 text-sm"
      style={{ width: '20rem' }}
      data-testid="scheduled-tasks-panel"
    >
      <ScheduledTasksListHeader />
    </div>
  );
};
