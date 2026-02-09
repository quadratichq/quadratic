//! This is a Jotai atom that manages the state of the scheduled tasks menu.

import {
  editorInteractionStateFileUuidAtom,
  editorInteractionStateShowValidationAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { scheduledTasksAPI } from '@/shared/api/scheduledTasksClient';
import { SEARCH_PARAMS } from '@/shared/constants/routes';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { atom, getDefaultStore, useAtom } from 'jotai';
import type { ScheduledTask, ScheduledTaskLog } from 'quadratic-shared/typesAndSchemasScheduledTasks';
import { useCallback, useEffect, useMemo, useRef } from 'react';
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

// Direct function to show scheduled tasks without React hooks
export const showScheduledTasksDialog = (taskId?: string | typeof CREATE_TASK_ID) => {
  const store = getDefaultStore();
  const currentState = store.get(scheduledTasksAtom);
  store.set(scheduledTasksAtom, {
    ...currentState,
    show: true,
    currentTaskId: taskId ?? null,
  });
};

export const useLoadScheduledTasks = () => {
  const [scheduledTasks, setScheduledTasks] = useAtom(scheduledTasksAtom);
  const showValidation = useRecoilValue(editorInteractionStateShowValidationAtom);
  const fileUuid = useRecoilValue(editorInteractionStateFileUuidAtom);
  const hasCheckedUrlParam = useRef(false);

  useEffect(() => {
    if (fileUuid) {
      scheduledTasksAPI.get(fileUuid).then((tasks) => {
        setScheduledTasks((prev) => ({ ...prev, tasks }));
      });

      // Check URL param regardless of API success (only once)
      if (!hasCheckedUrlParam.current) {
        hasCheckedUrlParam.current = true;
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.has(SEARCH_PARAMS.SCHEDULED_TASKS.KEY)) {
          setScheduledTasks((prev) => ({ ...prev, show: true }));

          searchParams.delete(SEARCH_PARAMS.SCHEDULED_TASKS.KEY);
          const newUrl = searchParams.toString()
            ? `${window.location.pathname}?${searchParams.toString()}`
            : window.location.pathname;
          window.history.replaceState({}, '', newUrl);
        }
      }
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
  getHistory: () => Promise<ScheduledTaskLog[]>;
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
      setScheduledTasks((prev) => {
        trackEvent('[ScheduledTasks].open', {
          taskId: taskId ?? null,
          hasExistingTasks: prev.tasks.length > 0,
        });
        return { ...prev, show: true, currentTaskId: taskId ?? null };
      });
    },
    [showValidation, setShowValidation, setScheduledTasks]
  );

  const closeScheduledTasks = useCallback(() => {
    setScheduledTasks((prev) => ({ ...prev, show: false }));
    trackEvent('[ScheduledTasks].close');
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
      setScheduledTasks((prev) => {
        const taskToDelete = prev.tasks.find((task) => task.uuid === taskId);
        trackEvent('[ScheduledTasks].delete', {
          taskUuid: taskId,
          cronExpression: taskToDelete?.cronExpression,
        });
        return { ...prev, tasks: prev.tasks.filter((task) => task.uuid !== taskId) };
      });
    },
    [fileUuid, setScheduledTasks]
  );

  const getHistory = useCallback(
    async (pageNumber = 1, pageSize = 10) => {
      if (!fileUuid || !currentTask?.uuid) return [];
      return scheduledTasksAPI.history(fileUuid, currentTask?.uuid ?? '', pageNumber, pageSize);
    },
    [fileUuid, currentTask?.uuid]
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
    getHistory,
  };
};
