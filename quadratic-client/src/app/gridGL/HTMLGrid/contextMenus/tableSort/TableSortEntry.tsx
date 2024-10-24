import { SortDirection } from '@/app/quadratic-core-types';
import { ValidationDropdown } from '@/app/ui/menus/Validations/Validation/ValidationUI/ValidationUI';
import { DeleteIcon, DownArrowIcon, UpArrowIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { useCallback, useState } from 'react';

interface Props {
  index: number;
  availableColumns: string[];
  name: string;
  direction: SortDirection;
  onChange: (index: number, column: string, direction: SortDirection) => void;
  onDelete: (index: number) => void;
  onReorder: (index: number, direction: 'up' | 'down') => void;
  last: boolean;
}

export const TableSortEntry = (props: Props) => {
  const { index, availableColumns, direction, name, onChange, onDelete, onReorder, last } = props;

  const [newColumn, setNewColumn] = useState<string | undefined>(name);
  const [newDirection, setNewDirection] = useState<SortDirection>(direction ?? 'Descending');

  const updateValues = useCallback(
    (column?: string, direction?: string) => {
      if (column !== undefined) setNewColumn(column);
      if (direction !== undefined) setNewDirection(direction as SortDirection);

      // only update if the new column and direction are valid
      if (column || newColumn) {
        console.log(column, newColumn);
        onChange(index, column ?? newColumn!, (direction as SortDirection) ?? newDirection!);
      }
    },
    [index, onChange, newColumn, newDirection]
  );

  return (
    <div className="flex h-fit w-full gap-2">
      <ValidationDropdown
        className="w-fit grow"
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
                <div className="mr-2" style={{ fontSize: 9 }}>
                  <div className="-my-3 text-primary">A</div>
                  <div className="-my-3">&darr;</div>
                  <div className="-my-3">Z</div>
                </div>
                <div>Ascending</div>
              </div>
            ),
            value: 'Ascending',
          },
          {
            label: (
              <div className="space-between flex w-full items-center">
                <div className="mr-2" style={{ fontSize: 9 }}>
                  <div className="-my-3">Z</div>
                  <div className="-my-3">&darr;</div>
                  <div className="-my-3 text-primary">A</div>
                </div>
                <div className="mr-2">Descending</div>
              </div>
            ),
            value: 'Descending',
          },
        ]}
        onChange={(direction) => updateValues(undefined, direction as SortDirection)}
      />
      <div className={cn('flex gap-1 p-0', name === '' ? 'invisible' : '')}>
        <Button variant="secondary" className="p-0" disabled={index === 0} onClick={() => onReorder(index, 'up')}>
          <UpArrowIcon />
        </Button>
        <Button variant="secondary" className="p-0" disabled={last} onClick={() => onReorder(index, 'down')}>
          <DownArrowIcon />
        </Button>
      </div>
      <Button className={name === '' ? 'invisible' : ''} onClick={() => onDelete(index)}>
        <DeleteIcon />
      </Button>
    </div>
  );
};
