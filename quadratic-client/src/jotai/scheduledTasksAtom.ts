//! This is a Jotai atom that manages the state of the scheduled tasks menu.

import {
  editorInteractionStateFileUuidAtom,
  editorInteractionStateShowValidationAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { cronToDays, cronToMinute, cronToTimeDays, cronType } from '@/app/ui/menus/ScheduledTasks/convertCronTime';
import type { ScheduledTaskIntervalType } from '@/app/ui/menus/ScheduledTasks/ScheduledTask/ScheduledTaskInterval';
import { scheduledTasksAPI } from '@/shared/api/scheduledTasksClient';
import { atom, useAtom, useAtomValue } from 'jotai';
import type { ScheduledTask } from 'quadratic-shared/typesAndSchemasScheduledTasks';
import { useCallback, useEffect, useMemo } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

export const CREATE_TASK_ID = 'CREATE';

export interface ScheduledTasks {
  show: boolean;
  currentTaskId: string | typeof CREATE_TASK_ID | null;
  tasks: ScheduledTask[];
}

// Convert the scheduled task to an editable object
export interface ScheduledTaskEditable {
  uuid: string;
  nextRunTime: string;
  lastRunTime: string | null;
  every: ScheduledTaskIntervalType;
  days: number[] | null;
  time: string | null;
  minute: number | null;
}

const defaultScheduledTasks: ScheduledTasks = {
  show: true,
  currentTaskId: null,
  tasks: [],
};

export const scheduledTasksAtom = atom<ScheduledTasks>(defaultScheduledTasks);

export const useLoadScheduledTasks = () => {
  const [scheduledTasks, setScheduledTasks] = useAtom(scheduledTasksAtom);
  const showValidation = useRecoilValue(editorInteractionStateShowValidationAtom);
  const fileUuid = useRecoilValue(editorInteractionStateFileUuidAtom);

  useEffect(() => {
    if (fileUuid) {
      scheduledTasksAPI.get(fileUuid).then((tasks) => {
        setScheduledTasks((prev) => ({ ...prev, tasks }));
      });
    }
  }, [fileUuid, setScheduledTasks]);

  useEffect(() => {
    if (showValidation && scheduledTasks.show) {
      setScheduledTasks((prev) => ({ ...prev, show: false }));
    }
  }, [scheduledTasks.show, setScheduledTasks, showValidation]);
};

export interface ScheduledTaskToSave {
  uuid: string;
  cronExpression: string;
  operations: any;
}

interface ScheduledTasksActions {
  showScheduledTasks: (taskId?: string) => void;
  closeScheduledTasks: () => void;
  newScheduledTask: () => void;
  saveScheduledTask: (task: ScheduledTaskToSave) => Promise<void>;
  scheduledTasks: ScheduledTasks;
  currentTask: ScheduledTask | null;
  currentTaskId: string | null;
  editableScheduledTasks: ScheduledTaskEditable[];
  deleteScheduledTask: (taskId: string) => void;
  show: boolean;
}

export const scheduledTasksEditableAtom = atom<ScheduledTaskEditable[]>((get) => {
  const scheduledTasks = get(scheduledTasksAtom);

  // Transform ScheduledTask[] to ScheduledTaskEditable[]
  return scheduledTasks.tasks.map((task) => {
    return {
      uuid: task.uuid,
      nextRunTime: task.nextRunTime,
      lastRunTime: task.lastRunTime,
      every: cronType(task.cronExpression),
      days: cronToDays(task.cronExpression),
      time: cronToTimeDays(task.cronExpression),
      minute: cronToMinute(task.cronExpression),
    } as ScheduledTaskEditable;
  });
});

export const useScheduledTasks = (): ScheduledTasksActions => {
  const [scheduledTasks, setScheduledTasks] = useAtom(scheduledTasksAtom);
  const [showValidation, setShowValidation] = useRecoilState(editorInteractionStateShowValidationAtom);
  const editableScheduledTasks = useAtomValue(scheduledTasksEditableAtom);
  const fileUuid = useRecoilValue(editorInteractionStateFileUuidAtom);

  const showScheduledTasks = useCallback(
    (taskId?: string) => {
      if (!!showValidation) {
        setShowValidation(false);
      }
      setScheduledTasks((prev) => ({ ...prev, show: true, currentTaskId: taskId ?? null }));
    },
    [showValidation, setShowValidation, setScheduledTasks]
  );

  const closeScheduledTasks = useCallback(() => {
    setScheduledTasks((prev) => ({ ...prev, show: false }));
  }, [setScheduledTasks]);

  const newScheduledTask = useCallback(() => {
    setScheduledTasks((prev) => ({ ...prev, currentTaskId: CREATE_TASK_ID }));
  }, [setScheduledTasks]);

  const currentTask = useMemo(() => {
    if (scheduledTasks.currentTaskId) {
      return scheduledTasks.tasks.find((task) => task.uuid === scheduledTasks.currentTaskId) ?? null;
    }
    return null;
  }, [scheduledTasks.currentTaskId, scheduledTasks.tasks]);

  const saveScheduledTask = useCallback(
    async (task: ScheduledTaskToSave) => {
      if (!fileUuid) return;
      if (scheduledTasks.currentTaskId === CREATE_TASK_ID) {
        const created = await scheduledTasksAPI.create(fileUuid, {
          cronExpression: task.cronExpression,
          operations: task.operations,
        });
        setScheduledTasks((prev) => ({
          ...prev,
          tasks: [...prev.tasks, created],
        }));
      } else {
        const updated = await scheduledTasksAPI.update(fileUuid, task.uuid, task);
        setScheduledTasks((prev) => ({
          ...prev,
          tasks: prev.tasks.map((task) => (task.uuid === updated.uuid ? updated : task)),
        }));
      }
    },
    [fileUuid, scheduledTasks.currentTaskId, setScheduledTasks]
  );

  const deleteScheduledTask = useCallback(
    async (taskId: string) => {
      if (!fileUuid) return;
      await scheduledTasksAPI.delete(fileUuid, taskId);
      setScheduledTasks((prev) => ({ ...prev, tasks: prev.tasks.filter((task) => task.uuid !== taskId) }));
    },
    [fileUuid, setScheduledTasks]
  );

  return {
    show: scheduledTasks.show,
    showScheduledTasks,
    closeScheduledTasks,
    newScheduledTask,
    scheduledTasks,
    currentTask,
    currentTaskId: scheduledTasks.currentTaskId,
    saveScheduledTask,
    editableScheduledTasks,
    deleteScheduledTask,
  };
};
