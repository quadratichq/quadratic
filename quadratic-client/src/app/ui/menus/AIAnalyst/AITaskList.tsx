import { aiAnalystCurrentChatTasksAtom } from '@/app/atoms/aiAnalystAtom';
import { aiTaskListMinimizedAtom } from '@/app/atoms/aiTaskListAtom';
import { CheckIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import { useAtom } from 'jotai';
import { memo } from 'react';
import { useRecoilValue } from 'recoil';
import type { AITask } from 'quadratic-shared/typesAndSchemasAI';

export const AITaskList = memo(() => {
  const tasks = useRecoilValue(aiAnalystCurrentChatTasksAtom);
  const [minimized, setMinimized] = useAtom(aiTaskListMinimizedAtom);

  if (tasks.length === 0) {
    return null;
  }

  const completedCount = tasks.filter((task) => task.completed).length;
  const totalCount = tasks.length;

  return (
    <div className="sticky bottom-0 z-10 border-t border-border bg-background px-2 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-1 items-center gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">Plan</h3>
          {minimized && (
            <span className="text-xs text-muted-foreground">
              {completedCount}/{totalCount} completed
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setMinimized((prev) => !prev)}
          className="h-6 w-6 shrink-0"
          aria-label={minimized ? 'Expand task list' : 'Minimize task list'}
        >
          {minimized ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />}
        </Button>
      </div>
      {!minimized && (
        <ul className="mt-2 space-y-1.5 pb-2">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </ul>
      )}
    </div>
  );
});

AITaskList.displayName = 'AITaskList';

const TaskItem = memo(({ task }: { task: AITask }) => {
  return (
    <li className="flex items-start gap-2 text-sm">
      <div
        className={cn(
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
          task.completed ? '' : 'border-border bg-background'
        )}
        style={
          task.completed
            ? {
                borderColor: '#a855f7',
                backgroundColor: '#a855f7',
                color: '#ffffff',
              }
            : undefined
        }
      >
        {task.completed && <CheckIcon className="h-3 w-3" />}
      </div>
      <span className={cn('flex-1', task.completed && 'text-muted-foreground line-through')}>{task.description}</span>
    </li>
  );
});

TaskItem.displayName = 'TaskItem';
