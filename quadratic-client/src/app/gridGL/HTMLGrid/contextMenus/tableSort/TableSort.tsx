//! Shows the Table Sort Dialog for a table

/* eslint-disable @typescript-eslint/no-unused-vars */
import { contextMenuAtom, ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { TableSortEntry } from '@/app/gridGL/HTMLGrid/contextMenus/tableSort/TableSortEntry';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { DataTableSort, SortDirection } from '@/app/quadratic-core-types';
import { Button } from '@/shared/shadcn/ui/button';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';

export const TableSort = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useRecoilState(contextMenuAtom);

  const handleClose = useCallback(() => {
    setContextMenu({});
  }, [setContextMenu]);

  const [sort, setSort] = useState<DataTableSort[]>([]);
  useEffect(() => {
    if (contextMenu.table && contextMenu.table.sort) {
      const sort = [...contextMenu.table.sort.filter((item) => item.direction !== 'None')];
      if (sort.length !== contextMenu.table.column_names.length) {
        sort.push({ column_index: -1, direction: 'None' });
      }
      setSort(sort);
    } else {
      setSort([{ column_index: -1, direction: 'None' }]);
    }
  }, [contextMenu.table]);

  const handleSave = useCallback(() => {
    if (contextMenu.table) {
      const sortToSend = sort.filter((item) => item.direction !== 'None' && item.column_index !== -1);
      console.log(
        `Sending table ${contextMenu.table.x},${contextMenu.table.y} with sort ${JSON.stringify(sortToSend)}`
      );
      // todo: need a fn to send the entire sorted data table
      // quadraticCore.sortDataTable(contextMenu.table, sort);
    }
    handleClose();
  }, [contextMenu.table, sort, handleClose]);

  useEffect(() => {
    const changePosition = () => {
      if (!ref.current) {
        setTimeout(changePosition, 0);
        return;
      }
      if (contextMenu.table) {
        const position = pixiApp.cellsSheet().tables.getSortDialogPosition(contextMenu.table);
        if (position) {
          ref.current.style.left = `${position.x}px`;
          ref.current.style.top = `${position.y}px`;
          ref.current.style.display = 'block';
        }
      }
    };
    const viewportChanged = () => {
      if (ref.current) {
        ref.current.style.transform = `scale(${1 / pixiApp.viewport.scaled})`;
      }
      changePosition();
    };

    changePosition();
    events.on('viewportChanged', viewportChanged);
    return () => {
      events.off('viewportChanged', viewportChanged);
    };
  }, [contextMenu.table]);

  const columnNames = useMemo(() => contextMenu.table?.column_names ?? [], [contextMenu.table]);
  const nonNoneSortItems = useMemo(() => sort.filter((item) => item.direction !== 'None') ?? [], [sort]);

  const availableColumns = useMemo(() => {
    const availableColumns = columnNames.filter(
      (_, index) => !nonNoneSortItems.some((item) => item.column_index === index)
    );
    return availableColumns.map((column) => column.name);
  }, [columnNames, nonNoneSortItems]);

  const handleChange = (index: number, column: string, direction: SortDirection) => {
    setSort((prev) => {
      const columnIndex = column === '' ? -1 : columnNames.findIndex((c) => c.name === column);
      const newSort = [...prev];
      newSort[index] = { column_index: columnIndex, direction };
      const last = newSort[newSort.length - 1];
      console.log(availableColumns);
      if (last.column_index !== -1 && availableColumns.length > 1) {
        newSort.push({ column_index: -1, direction: 'None' });
      }
      return newSort;
    });
  };

  const handleDelete = (index: number) => {
    setSort((prev) => {
      const sort = prev.filter((_, i) => i !== index);
      if (
        sort.length !== contextMenu.table?.column_names.length &&
        sort.length &&
        sort[sort.length - 1].column_index !== -1
      ) {
        sort.push({ column_index: -1, direction: 'None' });
      }
      return sort;
    });
  };

  if (contextMenu.type !== ContextMenuType.TableSort) return null;

  return (
    <div
      ref={ref}
      className="pointer-events-auto absolute hidden rounded-md border bg-background p-4 shadow-lg"
      style={{
        transformOrigin: 'top left',
        transform: `scale(${1 / pixiApp.viewport.scaled})`,
        width: 400,
      }}
    >
      <div className="mb-4 text-lg font-semibold">Table Sort</div>
      <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
        {sort.map((entry, index) => {
          const name = entry.column_index === -1 ? '' : contextMenu.table?.column_names[entry.column_index]?.name ?? '';
          const columns = name ? [name, ...availableColumns] : availableColumns;
          return (
            <TableSortEntry
              index={index}
              key={name}
              direction={entry.direction}
              name={name}
              availableColumns={columns}
              onChange={handleChange}
              onDelete={handleDelete}
            />
          );
        })}
      </div>
      <div className="mt-5 flex w-full justify-end gap-2">
        <Button variant="secondary" onClick={handleClose}>
          Cancel
        </Button>
        <Button onClick={handleSave}>Ok</Button>
      </div>
    </div>
  );
};
