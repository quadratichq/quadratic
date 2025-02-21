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
  availableColumns: string[];
  name: string;
  direction: SortDirection;
  onChange: (index: number, column: string | undefined, direction: SortDirection) => void;
  onDelete: (index: number) => void;
  onReorder: (index: number, direction: 'up' | 'down') => void;
  last: boolean;
}

export const TableSortEntry = (props: Props) => {
  const { index, availableColumns, direction, name, onChange, onDelete, onReorder, last } = props;

  const [newColumn, setNewColumn] = useState<string | undefined>(name);
  const [newDirection, setNewDirection] = useState<SortDirection>(direction ?? 'Ascending');

  const updateValues = useCallback(
    (column?: string, direction?: string) => {
      if (column === 'blank') {
        column = '';
      }
      if (column !== undefined) setNewColumn(column);
      if (direction !== undefined) setNewDirection(direction as SortDirection);

      // only update if the new column and direction are valid
      onChange(
        index,
        column === undefined ? newColumn ?? undefined : column,
        (direction as SortDirection) ?? newDirection
      );
      console.log(
        index,
        column === undefined ? newColumn ?? '' : column,
        (direction as SortDirection) ?? newDirection!
      );
    },
    [index, onChange, newColumn, newDirection]
  );

  return (
    <div className="flex h-fit w-full items-center gap-2">
      <span className="text-xs">{index + 1}.</span>
      <ValidationDropdown
        className="first-focus w-fit grow"
        style={{ paddingTop: 1, paddingBottom: 1, paddingLeft: 1 }}
        value={newColumn ?? ''}
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
          onClick={() => onReorder(index, 'up')}
        >
          <UpArrowIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn('w-7', last && '!opacity-20')}
          disabled={last}
          onClick={() => onReorder(index, 'down')}
        >
          <DownArrowIcon />
        </Button>
        <Button variant="ghost" size="icon" className={cn('w-7')} onClick={() => onDelete(index)}>
          <CloseIcon />
        </Button>
      </div>
    </div>
  );
};
