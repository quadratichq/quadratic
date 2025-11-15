//! Component for the Scheduled Task type (run-selected-cells, run-sheet-cells,
//! run-all-code) and related parameters.

import { SheetRange } from '@/app/ui/components/SheetRange';
import { ScheduledTaskInputGroup } from '@/app/ui/menus/ScheduledTasks/ScheduledTask/ScheduledTaskInputGroup';
import type { CronRange, TaskType } from '@/app/ui/menus/ScheduledTasks/useCronRange';
import { Label } from '@/shared/shadcn/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/shadcn/ui/select';

const TASKS: { value: TaskType; label: string }[] = [
  {
    value: 'run-all-code',
    label: 'Run file',
  },
  {
    value: 'run-sheet-cells',
    label: 'Run sheet',
  },
  {
    value: 'run-selected-cells',
    label: 'Run selection',
  },
];

interface Props {
  cronRange: CronRange;
}

export const ScheduledTaskType = (props: Props) => {
  const { task, range, rangeError, setTaskCallback, setRangeError, setSheet, sheetId, changeSelection, sheetList } =
    props.cronRange;

  return (
    <>
      <ScheduledTaskInputGroup>
        <Label htmlFor="scheduled-run-type" className="mt-1.5">
          Task
        </Label>
        <div className="flex flex-col gap-2">
          <Select value={task} onValueChange={setTaskCallback}>
            <SelectTrigger id="scheduled-run-type" className="select-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASKS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {task === 'run-sheet-cells' && (
            <Select value={sheetId} onValueChange={setSheet}>
              <SelectTrigger className="select-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64 overflow-y-auto">
                {sheetList.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {task === 'run-selected-cells' && (
            <SheetRange
              labelClassName="text-xs text-gray-500"
              initial={range?.selection()}
              onChangeSelection={changeSelection}
              onError={setRangeError}
              triggerError={!!rangeError}
              changeCursor={true}
              readOnly={false}
            />
          )}
        </div>
      </ScheduledTaskInputGroup>
    </>
  );
};
