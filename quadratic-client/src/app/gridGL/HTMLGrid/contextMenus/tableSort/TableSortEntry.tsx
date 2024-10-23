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
  last?: boolean;
}

export const TableSortEntry = (props: Props) => {
  const { index, availableColumns, direction, name, onChange, last } = props;

  const [newColumn, setNewColumn] = useState(name);
  const [newDirection, setNewDirection] = useState(direction);
  useEffect(() => {
    if (newColumn !== name && newDirection !== direction) {
      onChange(index, newColumn, newDirection);
    }
  }, [direction, index, name, newColumn, newDirection, onChange]);

  return (
    <div className="flex w-full gap-2">
      <Button variant="ghost" className={cn('p-0', last ? 'invisible' : '')}>
        <DragIndicatorIcon />
      </Button>
      <ValidationDropdown
        className="w-fit grow"
        value={newColumn}
        options={availableColumns}
        onChange={setNewColumn}
        includeBlank
      />
      <ValidationDropdown
        style={{ width: 140 }}
        value={newDirection}
        options={[
          { label: <> &uarr; Ascending</>, value: 'Ascending' },
          { label: <>&darr; Descending </>, value: 'Descending' },
        ]}
        onChange={(direction) => setNewDirection(direction as SortDirection)}
        includeBlank
      />
      <Button className={last ? 'invisible' : ''}>
        <DeleteIcon />
      </Button>
    </div>
  );
};
