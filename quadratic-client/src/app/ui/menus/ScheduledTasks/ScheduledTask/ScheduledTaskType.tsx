//! Component for the Scheduled Task type (run-selected-cells, run-sheet-cells,
//! run-all-code) and related parameters.

import { SheetRange } from '@/app/ui/components/SheetRange';
import type { CronRange, TaskType } from '@/app/ui/menus/ScheduledTasks/useCronRange';
import { ValidationDropdown } from '@/app/ui/menus/Validations/Validation/ValidationUI/ValidationUI';

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

interface Props {
  cronRange: CronRange;
}

export const ScheduledTaskType = (props: Props) => {
  const { task, range, rangeError, setTaskCallback, setRangeError, setSheet, sheetId, changeSelection, sheetList } =
    props.cronRange;

  return (
    <div className="flex flex-col gap-4 px-1">
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
          options={sheetList}
        />
      )}

      {task === 'run-selected-cells' && (
        <SheetRange
          label="Run code in range"
          labelClassName="text-xs text-gray-500"
          initial={range?.selection()}
          onChangeSelection={changeSelection}
          onError={setRangeError}
          triggerError={!!rangeError}
          changeCursor={true}
          readOnly={false}
          onlyCurrentSheet={sheetId}
        />
      )}
    </div>
  );
};
