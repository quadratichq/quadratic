import { sheets } from '@/app/grid/controller/Sheets';
import type { A1Selection } from '@/app/quadratic-core-types';
import type { JsSelection } from '@/app/quadratic-core/quadratic_core';
import { SheetRange } from '@/app/ui/components/SheetRange';
import { ScheduledTaskHeader } from '@/app/ui/menus/ScheduledTasks/ScheduledTask/ScheduledTaskHeader';
import { ScheduledTaskInterval } from '@/app/ui/menus/ScheduledTasks/ScheduledTask/ScheduledTaskInterval';
import { ValidationDropdown } from '@/app/ui/menus/Validations/Validation/ValidationUI/ValidationUI';
import { CREATE_TASK_ID, useScheduledTasks } from '@/jotai/scheduledTasksAtom';
import { Button } from '@/shared/shadcn/ui/button';
import { useCallback, useState } from 'react';

type tasks = 'run-selected-cells' | 'run-sheet-cells' | 'run-all-code';

const TASKS: { value: tasks; label: string }[] = [
  {
    value: 'run-all-code',
    label: 'Run all code in file',
  },
  {
    value: 'run-sheet-cells',
    label: 'Run all code in sheet',
  },
  {
    value: 'run-selected-cells',
    label: 'Run selected code',
  },
];

export const ScheduledTask = () => {
  const { currentTask, saveScheduledTask, deleteScheduledTask, showScheduledTasks } = useScheduledTasks();

  const [task, setTask] = useState<string>('run-all-code');

  const [sheet, setSheet] = useState(sheets.current);
  const [range, setRange] = useState<A1Selection | undefined>();
  const [rangeError, setRangeError] = useState(false);

  // default cron expression is every day at midnight
  const [cron, setCron] = useState('0 0 * * *');

  const changeSelection = useCallback((selection: JsSelection | undefined) => {
    if (selection) {
      setRange(selection.selection());
      setRangeError(false);
    } else {
      setRange(undefined);
    }
  }, []);

  const onSave = useCallback(async () => {
    if (!cron) return;

    // const operations = create_cron_operations(sheet, range)
    await saveScheduledTask({
      uuid: currentTask?.uuid ?? CREATE_TASK_ID,
      cronExpression: cron,
      operations: '',
    });
    showScheduledTasks();
  }, [cron, saveScheduledTask, currentTask?.uuid, showScheduledTasks]);

  const onDelete = useCallback(() => {
    if (currentTask) {
      deleteScheduledTask(currentTask.uuid);
      showScheduledTasks();
    }
  }, [currentTask, deleteScheduledTask, showScheduledTasks]);

  return (
    <div
      className="border-gray relative flex h-full shrink-0 flex-col justify-between border-l bg-background px-3 text-sm"
      style={{ width: '20rem' }}
      data-testid="scheduled-task-panel"
    >
      <div>
        <ScheduledTaskHeader />

        <div className="flex flex-col gap-4">
          <ValidationDropdown
            label="Task"
            labelClassName="text-xs text-gray-500"
            className="flex flex-col gap-1"
            options={TASKS}
            value={task}
            onChange={setTask}
          />

          {task === 'run-sheet-cells' && (
            <ValidationDropdown
              className="flex flex-col gap-1"
              label="Sheet"
              labelClassName="text-xs text-gray-500"
              onChange={setSheet}
              value={sheet}
              options={sheets.sheets.map((sheet) => ({
                value: sheet.id,
                label: sheet.name,
              }))}
            />
          )}

          {task === 'run-selected-cells' && (
            <SheetRange
              label="Run code in range"
              labelClassName="text-xs text-gray-500"
              initial={range}
              onChangeSelection={changeSelection}
              triggerError={rangeError}
              changeCursor={true}
              readOnly={false}
            />
          )}

          <ScheduledTaskInterval cron={cron} setCron={setCron} />
        </div>
      </div>

      <div className="m-2 flex flex-row justify-between">
        {currentTask ? (
          <Button onClick={onDelete} variant="secondary">
            Delete
          </Button>
        ) : (
          <div></div>
        )}
        <div className="flex justify-end gap-2">
          <Button onClick={() => showScheduledTasks()} variant="secondary">
            Cancel
          </Button>
          <Button onClick={onSave}>Save</Button>
        </div>
      </div>
    </div>
  );
};
