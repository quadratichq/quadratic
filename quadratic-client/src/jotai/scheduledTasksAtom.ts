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
  show: true,
  currentTaskId: 'CREATE',
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

        console.log({ scheduledTasks: tasks });
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
  showScheduledTasks: () => void;
  closeScheduledTasks: () => void;
  newScheduledTask: () => void;
  saveScheduledTask: (task: ScheduledTaskToSave) => Promise<void>;
  scheduledTasks: ScheduledTasks;
  currentTask: ScheduledTask | null;
}

export const useScheduledTasks = (): ScheduledTasksActions => {
  const [scheduledTasks, setScheduledTasks] = useAtom(scheduledTasksAtom);
  const [showValidation, setShowValidation] = useRecoilState(editorInteractionStateShowValidationAtom);
  const fileUuid = useRecoilValue(editorInteractionStateFileUuidAtom);

  const showScheduledTasks = useCallback(() => {
    if (!!showValidation) {
      setShowValidation(false);
    }
    setScheduledTasks((prev) => ({ ...prev, show: true, currentTaskId: null }));
  }, [showValidation, setShowValidation, setScheduledTasks]);

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
        const results = await scheduledTasksAPI.create(fileUuid, {
          cronExpression: task.cronExpression,
          operations: task.operations,
        });
        console.log(results);
      } else {
        await scheduledTasksAPI.update(fileUuid, task.uuid, task);
      }
    },
    [scheduledTasks.currentTaskId, fileUuid]
  );

  return { showScheduledTasks, closeScheduledTasks, newScheduledTask, scheduledTasks, currentTask, saveScheduledTask };
};
