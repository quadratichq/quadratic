import { sheets } from '@/app/grid/controller/Sheets';
import { scheduledTaskDecode } from '@/app/quadratic-core/quadratic_core';
import { useFileContext } from '@/app/ui/components/FileProvider';
import { getCronToListEntry } from '@/app/ui/menus/ScheduledTasks/useCronInterval';
import { scheduledTasksAtom, useScheduledTasks } from '@/jotai/scheduledTasksAtom';
import { ArrowRightIcon, ScheduledTasksIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { DOCUMENTATION_SCHEDULED_TASKS_URL } from '@/shared/constants/urls';
import { useFileRouteLoaderDataRequired } from '@/shared/hooks/useFileRouteLoaderData';
import { Button } from '@/shared/shadcn/ui/button';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useAtomValue } from 'jotai';
import { Link } from 'react-router';

export const ScheduledTasksList = () => {
  const scheduledTasks = useAtomValue(scheduledTasksAtom);

  const isEmpty = scheduledTasks.tasks.length === 0;

  return isEmpty ? <EmptyScheduledTasksList /> : <ScheduledTasksListBody />;
};

const EmptyScheduledTasksList = () => {
  const {
    team: { uuid: teamUuid },
    userMakingRequest: { teamPermissions },
  } = useFileRouteLoaderDataRequired();
  const { newScheduledTask } = useScheduledTasks();
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 text-center">
      <ScheduledTasksIcon size="lg" className="mb-4 text-muted-foreground" />
      <h4 className="font-bold">No scheduled tasks</h4>
      <p className="mt-1 text-muted-foreground">
        Schedule a task to run automatically at an interval on Quadratic's servers.{' '}
        <a className="underline" href={DOCUMENTATION_SCHEDULED_TASKS_URL}>
          Learn more.
        </a>
      </p>
      {teamPermissions?.includes('TEAM_EDIT') ? (
        <Button
          className="mt-4"
          onClick={() => {
            trackEvent('[ScheduledTasks].createNewTask');
            newScheduledTask();
          }}
        >
          Schedule a task
        </Button>
      ) : (
        <>
          <p className="mt-3 text-muted-foreground">
            You do not have permission to edit scheduled tasks for this file’s team.{' '}
            <Link to={ROUTES.TEAM_MEMBERS(teamUuid)} reloadDocument className="underline">
              Ask your team owner for permission.
            </Link>
          </p>
        </>
      )}
    </div>
  );
};

const getScheduledTaskName = (operations: number[]) => {
  try {
    const decoded = scheduledTaskDecode(new Uint8Array(operations));

    if (!decoded) {
      return 'Run file';
    }
    if (decoded.isAllSelected()) {
      return `Run '${decoded.getSheetName(sheets.jsA1Context)}'`;
    } else {
      return `Run ${decoded.toA1String(undefined, sheets.jsA1Context)}`;
    }
  } catch (e) {
    console.error('Error decoding scheduled task', e);
    return '';
  }
};

const ScheduledTasksListBody = () => {
  const { scheduledTasks, showScheduledTasks } = useScheduledTasks();
  const { timezone } = useFileContext();

  return (
    <div className="flex flex-col px-4 py-2">
      {scheduledTasks.tasks.map((task, i) => {
        return (
          <button
            key={task.uuid}
            className="relative -mx-2 flex h-fit flex-col items-start justify-between rounded px-2 py-2 hover:bg-accent"
            onClick={() => {
              trackEvent('[ScheduledTasks].viewTask', {
                taskUuid: task.uuid,
                cronExpression: task.cronExpression,
              });
              showScheduledTasks(task.uuid);
            }}
            autoFocus={i === 0}
          >
            <span className="font-medium">{getScheduledTaskName(task.operations)}</span>
            <span className="w-10/12 truncate text-left text-xs text-muted-foreground">
              {getCronToListEntry(task.cronExpression, timezone ?? undefined)}
            </span>

            <ArrowRightIcon className="absolute right-3 top-2 mt-2 text-muted-foreground opacity-50" />
          </button>
        );
      })}
    </div>
  );
};
