import { aiAnalystCurrentChatTasksAtom } from '@/app/atoms/aiAnalystAtom';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';
import { useRecoilValue } from 'recoil';

export function useTaskListContextMessages() {
  const tasks = useRecoilValue(aiAnalystCurrentChatTasksAtom);

  const getTaskListContext = useCallback((): ChatMessage[] => {
    if (tasks.length === 0) {
      return [];
    }

    const completedCount = tasks.filter((task) => task.completed).length;
    const totalCount = tasks.length;
    const taskListText = tasks
      .map((task, index) => {
        const status = task.completed ? '✓' : '○';
        return `${status} ${task.description}`;
      })
      .join('\n');

    return [
      {
        role: 'user',
        content: [
          createTextContent(
            `Note: This is an internal message for context. Do not quote it in your response.\n\nCurrent task list progress (${completedCount}/${totalCount} completed):\n\n${taskListText}\n\nUse this task list to track your progress. Update it using the set_task_list tool as you complete tasks or need to add new ones.\n\nRemember: When tasks involve adding data to the sheet, ensure formatting and column resizing are included. Format cells with data (not table data - tables handle their own formatting). Auto-resize columns that will contain large content.`
          ),
        ],
        contextType: 'taskList',
      },
      {
        role: 'assistant',
        content: [
          createTextContent(
            `I understand the current task list and will use it to track progress. I will update it as I complete tasks.`
          ),
        ],
        contextType: 'taskList',
      },
    ];
  }, [tasks]);

  return { getTaskListContext };
}
