//! This is a Jotai atom that manages the state of the scheduled tasks menu.

import {
  editorInteractionStateFileUuidAtom,
  editorInteractionStateShowValidationAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { scheduledTasksAPI } from '@/shared/api/scheduledTasksClient';
import { atom, useAtom } from 'jotai';
import type { ScheduledTask } from 'quadratic-shared/typesAndSchemasScheduledTasks';
import { useCallback, useEffect, useMemo } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

export const CREATE_TASK_ID = 'CREATE';

export interface ScheduledTasks {
  show: boolean;
  currentTaskId: string | typeof CREATE_TASK_ID | null;
  tasks: ScheduledTask[];
}

const defaultScheduledTasks: ScheduledTasks = {
  show: false,
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
  operations: Uint8Array<ArrayBuffer>;
}

interface ScheduledTasksActions {
  showScheduledTasks: (taskId?: string) => void;
  closeScheduledTasks: () => void;
  newScheduledTask: () => void;
  saveScheduledTask: (task: ScheduledTaskToSave) => Promise<void>;
  scheduledTasks: ScheduledTasks;
  currentTask: ScheduledTask | null;
  currentTaskId: string | null;
  deleteScheduledTask: (taskId: string) => void;
  show: boolean;
}
export const useScheduledTasks = (): ScheduledTasksActions => {
  const [scheduledTasks, setScheduledTasks] = useAtom(scheduledTasksAtom);
  const [showValidation, setShowValidation] = useRecoilState(editorInteractionStateShowValidationAtom);
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
          operations: Array.from(task.operations),
        });
        setScheduledTasks((prev) => ({
          ...prev,
          tasks: [created, ...prev.tasks],
        }));
      } else {
        const updated = await scheduledTasksAPI.update(fileUuid, task.uuid, {
          cronExpression: task.cronExpression,
          operations: Array.from(task.operations),
        });
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
    deleteScheduledTask,
  };
};
