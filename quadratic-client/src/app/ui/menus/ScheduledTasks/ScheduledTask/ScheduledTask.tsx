//! This component creates and edits a scheduled task.

import { scheduledTaskEncode } from '@/app/quadratic-core/quadratic_core';
import { useFileContext } from '@/app/ui/components/FileProvider';
import { ScheduledTaskHistory } from '@/app/ui/menus/ScheduledTasks/ScheduledTask/ScheduledTaskHistory';
import { ScheduledTaskInterval } from '@/app/ui/menus/ScheduledTasks/ScheduledTask/ScheduledTaskInterval';
import { ScheduledTaskType } from '@/app/ui/menus/ScheduledTasks/ScheduledTask/ScheduledTaskType';
import { UseCronInterval } from '@/app/ui/menus/ScheduledTasks/useCronInterval';
import { useCronRange } from '@/app/ui/menus/ScheduledTasks/useCronRange';
import { CREATE_TASK_ID, useScheduledTasks } from '@/jotai/scheduledTasksAtom';
import { ROUTES } from '@/shared/constants/routes';
import { useFileRouteLoaderDataRequired } from '@/shared/hooks/useFileRouteLoaderData';
import { Button } from '@/shared/shadcn/ui/button';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useCallback } from 'react';
import { Link } from 'react-router';

export const ScheduledTask = () => {
  const {
    team: { uuid: teamUuid },
    userMakingRequest: { teamPermissions },
  } = useFileRouteLoaderDataRequired();
  const { timezone } = useFileContext();
  const { currentTask, saveScheduledTask, deleteScheduledTask, showScheduledTasks, getHistory } = useScheduledTasks();

  // holds all data/fns for the cron expression
  const cronInterval = UseCronInterval(currentTask?.cronExpression, timezone ?? undefined);
  const cronRange = useCronRange(currentTask?.operations);

  // Extract values to avoid recreating callback when other currentTask properties change
  const currentTaskUuid = currentTask?.uuid;
  const isCreateMode = !currentTask;

  const onSave = useCallback(async () => {
    if (!cronInterval.cron || cronInterval.cronError || cronRange.rangeError) return;
    const cloned = cronRange.range?.clone();
    const operations = scheduledTaskEncode(cloned);

    trackEvent(`[ScheduledTasks].${isCreateMode ? 'create' : 'update'}`, {
      cronExpression: cronInterval.cron,
      cronType: cronInterval.cronType,
      taskType: cronRange.task,
      taskUuid: currentTaskUuid,
    });

    await saveScheduledTask({
      uuid: currentTaskUuid ?? CREATE_TASK_ID,
      cronExpression: cronInterval.cron,
      operations,
    });
    showScheduledTasks();
  }, [
    cronInterval.cron,
    cronInterval.cronError,
    cronInterval.cronType,
    cronRange.rangeError,
    cronRange.range,
    cronRange.task,
    currentTaskUuid,
    isCreateMode,
    saveScheduledTask,
    showScheduledTasks,
  ]);

  const onDelete = useCallback(() => {
    if (currentTask) {
      deleteScheduledTask(currentTask.uuid);
      showScheduledTasks();
    }
  }, [currentTask, deleteScheduledTask, showScheduledTasks]);

  if (!teamPermissions?.includes('TEAM_EDIT')) {
    return (
      <div className="mt-4 px-4 text-center text-muted-foreground">
        You do not have permission to edit scheduled tasks for this file’s team.{' '}
        <Link to={ROUTES.TEAM_MEMBERS(teamUuid)} className="underline" reloadDocument>
          Ask your team owner for permission.
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
      <div className="flex-shrink-0 space-y-4 pb-4">
        <ScheduledTaskType cronRange={cronRange} />
        <ScheduledTaskInterval cronInterval={cronInterval} />
      </div>
      {currentTask && (
        <div className="flex min-h-0 flex-1 flex-col pb-4">
          <ScheduledTaskHistory getHistory={getHistory} currentTaskUuid={currentTask.uuid} />
        </div>
      )}
      <div className="flex flex-shrink-0 flex-row justify-end gap-2">
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
