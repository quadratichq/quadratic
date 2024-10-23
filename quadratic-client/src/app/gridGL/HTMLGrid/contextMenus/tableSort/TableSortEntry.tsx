import { SortDirection } from '@/app/quadratic-core-types';
import { ValidationDropdown } from '@/app/ui/menus/Validations/Validation/ValidationUI/ValidationUI';
import { DeleteIcon, DragIndicatorIcon } from '@/shared/components/Icons';
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
  last?: boolean;
}

export const TableSortEntry = (props: Props) => {
  const { index, availableColumns, direction, name, onChange, onDelete, last } = props;

  const [newColumn, setNewColumn] = useState(name);
  const [newDirection, setNewDirection] = useState(direction);
  useEffect(() => {
    if (newColumn !== name && newDirection !== direction) {
      onChange(index, newColumn, newDirection);
    }
  }, [direction, index, name, newColumn, newDirection, onChange]);

  return (
    <div className="flex h-fit w-full gap-2">
      <Button variant="ghost" className={cn('p-0', last ? 'invisible' : '')}>
        <DragIndicatorIcon />
      </Button>
      <ValidationDropdown
        className="w-fit grow"
        style={{ paddingTop: 1, paddingBottom: 1 }}
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
      <Button className={last ? 'invisible' : ''} onClick={() => onDelete(index)}>
        <DeleteIcon />
      </Button>
    </div>
  );
};
