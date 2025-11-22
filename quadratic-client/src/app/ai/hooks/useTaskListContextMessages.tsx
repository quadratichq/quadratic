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
            `Note: This is an internal message for context. Do not quote it in your response.\n\nCurrent task list progress (${completedCount}/${totalCount} completed):\n\n${taskListText}\n\nUse this task list to track your progress. Update it using the set_task_list tool as you complete tasks or need to add new ones.\n\nCRITICAL REMINDER: If ANY task uses set_cell_values (adding non-table data), you MUST have a formatting task immediately following it. This is REQUIRED. Formatting tasks should use set_text_formats to apply appropriate number formats, alignment, and styling. Table data (added via add_data_table) does NOT need formatting tasks. If you notice a set_cell_values task without a corresponding formatting task, immediately update the task list to add one before proceeding.`
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
