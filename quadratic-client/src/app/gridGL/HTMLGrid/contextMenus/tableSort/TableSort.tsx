//! Shows the Table Sort Dialog for a table

import { contextMenuAtom, ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { TableSortEntry } from '@/app/gridGL/HTMLGrid/contextMenus/tableSort/TableSortEntry';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { DataTableSort, SortDirection } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Button } from '@/shared/shadcn/ui/button';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';

export const TableSort = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useRecoilState(contextMenuAtom);

  const handleClose = useCallback(() => {
    setContextMenu({});
  }, [setContextMenu]);

  // focus on the first input when the dialog is opened
  useEffect(() => {
    if (contextMenu.type === ContextMenuType.TableSort) {
      setTimeout(() => {
        (ref.current?.querySelector('.first-focus')?.children[0] as HTMLElement)?.focus();
      });
    }
  }, [contextMenu]);

  const [sort, setSort] = useState<DataTableSort[]>([]);
  useEffect(() => {
    if (contextMenu.type !== ContextMenuType.TableSort) return;
    if (contextMenu.table) {
      const sort = contextMenu.table.sort
        ? [...contextMenu.table.sort.filter((item) => item.direction !== 'None')]
        : [];
      if (sort.length !== contextMenu.table.columns.length) {
        sort.push({ column_index: -1, direction: 'Ascending' });
      }
      setSort(sort);
    } else {
      setSort([{ column_index: -1, direction: 'Ascending' }]);
    }
  }, [contextMenu]);

  const handleSave = useCallback(() => {
    if (contextMenu.table) {
      const sortToSend = sort.filter((item) => item.direction !== 'None' && item.column_index !== -1);
      quadraticCore.sortDataTable(
        sheets.current,
        contextMenu.table.x,
        contextMenu.table.y,
        sortToSend,
        sheets.getCursorPosition()
      );
    }
    handleClose();
  }, [contextMenu.table, sort, handleClose]);

  const [display, setDisplay] = useState('none');
  useEffect(() => {
    const changePosition = () => {
      if (!ref.current) {
        if (contextMenu.table) {
          setTimeout(changePosition, 0);
        }
        return;
      }
      if (contextMenu.table) {
        const position = pixiApp.cellsSheet().tables.getSortDialogPosition(contextMenu.table);
        if (position) {
          ref.current.style.left = `${position.x}px`;
          ref.current.style.top = `${position.y}px`;
          ref.current.style.display = 'block';
          setDisplay('block');
        }
      } else {
        setDisplay('none');
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

  const columnNames = useMemo(() => contextMenu.table?.columns ?? [], [contextMenu.table]);

  const availableColumns = useMemo(() => {
    const availableColumns = columnNames.filter((_, index) => !sort.some((item) => item.column_index === index));
    return availableColumns.map((column) => column.name);
  }, [columnNames, sort]);

  const handleChange = useCallback(
    (index: number, column: string | undefined, direction: SortDirection) => {
      setSort((prev) => {
        const columnIndex = columnNames.findIndex((c) => c.name === column);

        // remove any additional entries
        const newSort = [...prev.filter((item) => item.column_index !== -1)];

        if (columnIndex === -1) {
          newSort.splice(index, 1);
        } else {
          if (index === -1) {
            newSort.push({ column_index: columnIndex, direction });
          } else {
            newSort[index] = { column_index: columnIndex, direction };
          }
        }

        if (newSort.length !== columnNames.length) {
          newSort.push({ column_index: -1, direction: 'Ascending' });
        }
        return newSort;
      });
    },
    [columnNames]
  );

  const handleDelete = useCallback(
    (index: number) => {
      setSort((prev) => {
        const sort = prev.filter((_, i) => i !== index);
        if (
          sort.length !== contextMenu.table?.columns.length &&
          sort.length &&
          sort[sort.length - 1].column_index !== -1
        ) {
          sort.push({ column_index: -1, direction: 'Ascending' });
        }
        return sort;
      });
    },
    [contextMenu.table?.columns.length]
  );

  const handleReorder = useCallback((index: number, direction: 'up' | 'down') => {
    setSort((prev) => {
      const sort = [...prev];
      sort.splice(index, 1);
      sort.splice(index + (direction === 'up' ? -1 : 1), 0, prev[index]);
      return sort;
    });
  }, []);

  if (contextMenu.type !== ContextMenuType.TableSort) return null;

  return (
    <div
      ref={ref}
      className="pointer-events-auto absolute hidden rounded-md border bg-background p-4 shadow-lg"
      style={{
        transformOrigin: 'top left',
        transform: `scale(${1 / pixiApp.viewport.scaled})`,
        width: 450,
        display,
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          handleClose();
        } else if (e.key === 'Enter') {
          handleSave();
        }
        e.stopPropagation();
      }}
    >
      <div className="mb-4 text-lg font-semibold">Table sort</div>
      <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
        {sort.map((entry, index) => {
          const name = entry.column_index === -1 ? '' : contextMenu.table?.columns[entry.column_index]?.name ?? '';
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
              onReorder={handleReorder}
              last={
                index === sort.length - 1 || (sort[sort.length - 1].column_index === -1 && index === sort.length - 2)
              }
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