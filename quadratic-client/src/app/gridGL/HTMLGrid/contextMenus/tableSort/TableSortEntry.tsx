import type { SortDirection } from '@/app/quadratic-core-types';
import { ValidationDropdown } from '@/app/ui/menus/Validations/Validation/ValidationUI/ValidationUI';
import {
  CloseIcon,
  DownArrowIcon,
  SortAscendingIcon,
  SortDescendingIcon,
  UpArrowIcon,
} from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { useCallback, useState } from 'react';

interface Props {
  index: number;
  columnIndex: number;
  availableColumns: string[];
  name: string;
  direction: SortDirection;
  onChange: (index: number, column: string | undefined, direction: SortDirection) => void;
  onDelete: (index: number) => void;
  onReorder: (index: number, direction: 'up' | 'down') => void;
  last: boolean;
}

export const TableSortEntry = (props: Props) => {
  const { index, columnIndex, availableColumns, direction, name, onChange, onDelete, onReorder, last } = props;

  const [newColumn, setNewColumn] = useState<string | undefined>(name);
  const [newDirection, setNewDirection] = useState<SortDirection>(direction);

  const updateValues = useCallback(
    (column?: string, direction?: SortDirection) => {
      if (column === 'blank') {
        column = '';
      }
      if (column !== undefined) setNewColumn(column);
      if (direction !== undefined) setNewDirection(direction);

      onChange(columnIndex, column === undefined ? newColumn : column, direction ?? newDirection);
    },
    [onChange, columnIndex, newColumn, newDirection]
  );

  return (
    <div className="flex h-fit w-full items-center gap-2">
      <span className="text-xs">{index + 1}.</span>
      <ValidationDropdown
        className="first-focus w-fit grow"
        style={{ paddingTop: 1, paddingBottom: 1, paddingLeft: 1 }}
        value={name}
        options={availableColumns}
        onChange={(column) => updateValues(column)}
        includeBlank
      />
      <ValidationDropdown
        style={{ width: 150, paddingTop: 1, paddingBottom: 1 }}
        value={newDirection}
        options={[
          {
            label: (
              <div className="flex w-full items-center">
                <SortAscendingIcon className="mr-1" />
                <div>Ascending</div>
              </div>
            ),
            value: 'Ascending',
          },
          {
            label: (
              <div className="space-between flex w-full items-center">
                <SortDescendingIcon className="mr-1" />
                <div className="mr-2">Descending</div>
              </div>
            ),
            value: 'Descending',
          },
        ]}
        onChange={(direction) => updateValues(undefined, direction as SortDirection)}
      />
      <div className={cn('flex p-0', name === '' ? 'invisible' : '')}>
        <Button
          variant="ghost"
          size="icon"
          className={cn('w-7', index === 0 && '!opacity-20')}
          disabled={index === 0}
          onClick={() => onReorder(columnIndex, 'up')}
        >
          <UpArrowIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn('w-7', last && '!opacity-20')}
          disabled={last}
          onClick={() => onReorder(columnIndex, 'down')}
        >
          <DownArrowIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn('w-7')}
          onClick={() => {
            onDelete(columnIndex);
          }}
        >
          <CloseIcon />
        </Button>
      </div>
    </div>
  );
};
