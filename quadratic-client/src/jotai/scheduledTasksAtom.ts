import { editorInteractionStateShowValidationAtom } from '@/app/atoms/editorInteractionStateAtom';
import { scheduledTasksAPI } from '@/shared/api/scheduledTasksClient';
import { atom, useAtom, useSetAtom } from 'jotai';
import type { ScheduledTask } from 'quadratic-shared/typesAndSchemasScheduledTasks';
import { useCallback, useEffect } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

export interface ScheduledTasks {
  show: boolean;
  currentTaskId: string | null;
  tasks: ScheduledTask[];
}

const defaultScheduledTasks: ScheduledTasks = {
  show: true, // TODO: should be false for release
  currentTaskId: null,
  tasks: [],
};

export const scheduledTasksAtom = atom<ScheduledTasks>(defaultScheduledTasks);

export const useLoadScheduledTasks = (fileUuid?: string) => {
  const [scheduledTasks, setScheduledTasks] = useAtom(scheduledTasksAtom);
  const showValidation = useRecoilValue(editorInteractionStateShowValidationAtom);

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

export const useShowScheduledTasks = (): { showScheduledTasks: () => void; closeScheduledTasks: () => void } => {
  const setScheduledTasks = useSetAtom(scheduledTasksAtom);
  const [showValidation, setShowValidation] = useRecoilState(editorInteractionStateShowValidationAtom);

  const showScheduledTasks = useCallback(() => {
    if (!!showValidation) {
      setShowValidation(false);
    }
    setScheduledTasks((prev) => ({ ...prev, show: true }));
  }, [showValidation, setShowValidation, setScheduledTasks]);

  const closeScheduledTasks = useCallback(() => {
    setScheduledTasks((prev) => ({ ...prev, show: false }));
  }, [setScheduledTasks]);

  return { showScheduledTasks, closeScheduledTasks };
};
