import { sheets } from '@/app/grid/controller/Sheets';
import { JsSelection, scheduledTaskDecode, scheduledTaskEncode } from '@/app/quadratic-core/quadratic_core';
import { SheetRange } from '@/app/ui/components/SheetRange';
import { UseCron } from '@/app/ui/menus/ScheduledTasks/CronTime';
import { ScheduledTaskHeader } from '@/app/ui/menus/ScheduledTasks/ScheduledTask/ScheduledTaskHeader';
import { ScheduledTaskInterval } from '@/app/ui/menus/ScheduledTasks/ScheduledTask/ScheduledTaskInterval';
import { ValidationDropdown } from '@/app/ui/menus/Validations/Validation/ValidationUI/ValidationUI';
import { CREATE_TASK_ID, useScheduledTasks } from '@/jotai/scheduledTasksAtom';
import { Button } from '@/shared/shadcn/ui/button';
import { useCallback, useEffect, useMemo, useState } from 'react';

type TaskType = 'run-selected-cells' | 'run-sheet-cells' | 'run-all-code';

const TASKS: { value: TaskType; label: string }[] = [
  {
    value: 'run-all-code',
    label: 'Run entire file',
  },
  {
    value: 'run-sheet-cells',
    label: 'Run entire sheet',
  },
  {
    value: 'run-selected-cells',
    label: 'Run selected cells',
  },
];

export const ScheduledTask = () => {
  const { currentTask, saveScheduledTask, deleteScheduledTask, showScheduledTasks } = useScheduledTasks();

  const [range, setRange] = useState<JsSelection | undefined>();

  // decode any existing operations
  useEffect(() => {
    if (currentTask?.operations) {
      setRange(scheduledTaskDecode(new Uint8Array(currentTask.operations)));
    }
  }, [currentTask?.operations]);

  const [rangeError] = useState(false);

  const setTaskCallback = useCallback((task: string) => {
    if (task === 'run-all-code') {
      setRange(undefined);
    } else if (task === 'run-sheet-cells') {
      const selection = new JsSelection(sheets.current);
      selection.selectSheet(sheets.current);
      setRange(selection);
    } else if (task === 'run-selected-cells') {
      setRange(sheets.sheet.cursor.jsSelection.clone());
    }
  }, []);

  const task = useMemo((): TaskType => {
    if (!range) return 'run-all-code';
    if (range.isAllSelected()) return 'run-sheet-cells';
    return 'run-selected-cells';
  }, [range]);

  // holds all data/fns for the cron expression
  const cronResults = UseCron(currentTask?.cronExpression);

  const setSheet = useCallback((sheet: string) => {
    const selection = new JsSelection(sheet);
    selection.selectSheet(sheet);
    setRange(selection);
  }, []);

  const sheetId = useMemo((): string => {
    if (!range) return sheets.current;
    return range.getSheetId();
  }, [range]);

  const changeSelection = useCallback((selection: JsSelection | undefined) => {
    if (selection) {
      setRange(selection);
    } else {
      setRange(undefined);
    }
  }, []);

  const onSave = useCallback(async () => {
    if (!cronResults.cron || cronResults.cronError) return;
    const operations = scheduledTaskEncode(range?.clone());
    await saveScheduledTask({
      uuid: currentTask?.uuid ?? CREATE_TASK_ID,
      cronExpression: cronResults.cron,
      operations,
    });
    showScheduledTasks();
  }, [cronResults.cron, cronResults.cronError, range, saveScheduledTask, currentTask?.uuid, showScheduledTasks]);

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
            onChange={setTaskCallback}
          />

          {task === 'run-sheet-cells' && (
            <ValidationDropdown
              className="flex flex-col gap-1"
              label="Sheet"
              labelClassName="text-xs text-gray-500"
              onChange={setSheet}
              value={sheetId}
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
              initial={range?.selection()}
              onChangeSelection={changeSelection}
              triggerError={rangeError}
              changeCursor={true}
              readOnly={false}
              onlyCurrentSheet={sheetId}
            />
          )}

          <ScheduledTaskInterval cronResults={cronResults} />
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
          <Button disabled={!!cronResults.cronError} onClick={onSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};
