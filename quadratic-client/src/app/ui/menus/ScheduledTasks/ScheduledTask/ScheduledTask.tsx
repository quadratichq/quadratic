//! This component creates and edits a scheduled task.

import { scheduledTaskEncode } from '@/app/quadratic-core/quadratic_core';
import { ScheduledTaskHeader } from '@/app/ui/menus/ScheduledTasks/ScheduledTask/ScheduledTaskHeader';
import { ScheduledTaskInterval } from '@/app/ui/menus/ScheduledTasks/ScheduledTask/ScheduledTaskInterval';
import { ScheduledTaskType } from '@/app/ui/menus/ScheduledTasks/ScheduledTask/ScheduledTaskType';
import { UseCronInterval } from '@/app/ui/menus/ScheduledTasks/useCronInterval';
import { useCronRange } from '@/app/ui/menus/ScheduledTasks/useCronRange';
import { CREATE_TASK_ID, useScheduledTasks } from '@/jotai/scheduledTasksAtom';
import { Button } from '@/shared/shadcn/ui/button';
import { useCallback } from 'react';

export const ScheduledTask = () => {
  const { currentTask, saveScheduledTask, deleteScheduledTask, showScheduledTasks } = useScheduledTasks();

  // holds all data/fns for the cron expression
  const cronInterval = UseCronInterval(currentTask?.cronExpression);
  const cronRange = useCronRange(currentTask?.operations);

  const onSave = useCallback(async () => {
    if (!cronInterval.cron || cronInterval.cronError || cronRange.rangeError) return;
    const cloned = cronRange.range?.clone();
    const operations = scheduledTaskEncode(cloned);
    await saveScheduledTask({
      uuid: currentTask?.uuid ?? CREATE_TASK_ID,
      cronExpression: cronInterval.cron,
      operations,
    });
    showScheduledTasks();
  }, [
    cronInterval.cron,
    cronInterval.cronError,
    cronRange.rangeError,
    cronRange.range,
    saveScheduledTask,
    currentTask?.uuid,
    showScheduledTasks,
  ]);

  const onDelete = useCallback(() => {
    if (currentTask) {
      deleteScheduledTask(currentTask.uuid);
      showScheduledTasks();
    }
  }, [currentTask, deleteScheduledTask, showScheduledTasks]);

  return (
    <div
      className="border-gray relative flex h-full w-full shrink-0 flex-col justify-between border-l bg-background px-3 text-sm"
      style={{ width: '20rem' }}
      data-testid="scheduled-task-panel"
    >
      <div>
        <ScheduledTaskHeader />

        <div className="overflow-y-scroll">
          <ScheduledTaskType cronRange={cronRange} />
          <ScheduledTaskInterval cronInterval={cronInterval} />
        </div>
      </div>

      <div className="m-2 flex flex-row justify-between">
        {currentTask ? (
          <Button onClick={onDelete} variant="secondary">
            Delete
          </Button>
        ) : (
          <div></div>
        )}
        <div className="flex justify-end gap-2">
          <Button onClick={() => showScheduledTasks()} variant="secondary">
            Cancel
          </Button>
          <Button disabled={!!cronInterval.cronError || !!cronRange.rangeError} onClick={onSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};
