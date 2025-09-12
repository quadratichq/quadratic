//! This component creates and edits a scheduled task.

import { scheduledTaskEncode } from '@/app/quadratic-core/quadratic_core';
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
    <div className="flex flex-col overflow-y-auto px-4 pb-2">
      <ScheduledTaskType cronRange={cronRange} />
      <ScheduledTaskInterval cronInterval={cronInterval} />

      <div className="mt-4 flex flex-row justify-end gap-2">
        {currentTask && (
          <Button onClick={onDelete} variant="outline-destructive" className="mr-auto">
            Delete
          </Button>
        )}
        <Button onClick={() => showScheduledTasks()} variant="secondary">
          Cancel
        </Button>
        <Button disabled={!!cronInterval.cronError || !!cronRange.rangeError} onClick={onSave}>
          Save
        </Button>
      </div>
    </div>
  );
};
