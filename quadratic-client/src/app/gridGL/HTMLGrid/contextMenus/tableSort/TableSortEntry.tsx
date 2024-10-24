import { SortDirection } from '@/app/quadratic-core-types';
import { ValidationDropdown } from '@/app/ui/menus/Validations/Validation/ValidationUI/ValidationUI';
import { DeleteIcon, DownArrowIcon, UpArrowIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { useEffect, useState } from 'react';

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

  const [newColumn, setNewColumn] = useState(name);
  const [newDirection, setNewDirection] = useState(direction);
  useEffect(() => {
    if (newColumn !== name && newDirection !== direction) {
      onChange(index, newColumn, newDirection);
    }
  }, [direction, index, name, newColumn, newDirection, onChange]);

  return (
    <div className="flex h-fit w-full gap-2">
      <ValidationDropdown
        className="w-fit grow"
        style={{ paddingTop: 1, paddingBottom: 1, paddingLeft: 1 }}
        value={newColumn}
        options={availableColumns}
        onChange={setNewColumn}
        includeBlank
      />
      <ValidationDropdown
        style={{ width: 140, paddingTop: 1, paddingBottom: 1 }}
        value={newDirection}
        options={[
          { label: <> &uarr; Ascending</>, value: 'Ascending' },
          { label: <>&darr; Descending </>, value: 'Descending' },
        ]}
        onChange={(direction) => setNewDirection(direction as SortDirection)}
        includeBlank
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
