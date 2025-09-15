//! Shows the Table Sort Dialog for a table

import { contextMenuAtom, ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { TableSortEntry } from '@/app/gridGL/HTMLGrid/contextMenus/tableSort/TableSortEntry';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { DataTableSort, SortDirection } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Button } from '@/shared/shadcn/ui/button';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';

export const TableSort = () => {
  const divRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useRecoilState(contextMenuAtom);

  const handleClose = useCallback(() => {
    setContextMenu({});
  }, [setContextMenu]);

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
      quadraticCore.sortDataTable(sheets.current, contextMenu.table.x, contextMenu.table.y, sortToSend);
    }
    handleClose();
  }, [contextMenu.table, sort, handleClose]);

  const changePosition = useCallback(
    (div: HTMLDivElement | null) => {
      if (!div) {
        return;
      }

      if (contextMenu.table) {
        const position = content.cellsSheet.tables.getSortDialogPosition(contextMenu.table);
        if (position) {
          div.style.left = `${position.x}px`;
          div.style.top = `${position.y}px`;
          div.style.display = 'block';
          setDisplay('block');
        }
      } else {
        setDisplay('none');
      }
    },
    [contextMenu.table]
  );

  const [display, setDisplay] = useState('none');
  useLayoutEffect(() => {
    const viewportChanged = () => {
      if (divRef.current) {
        divRef.current.style.transform = `scale(${1 / pixiApp.viewport.scaled})`;
      }
      changePosition(divRef.current);
    };

    events.on('viewportChanged', viewportChanged);
    return () => {
      events.off('viewportChanged', viewportChanged);
    };
  }, [changePosition, contextMenu.table]);

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
          // If no column selected, remove the entry at the specified index
          if (index >= 0 && index < newSort.length) {
            newSort.splice(index, 1);
          }
        } else {
          // Update or add entry at the specified index
          if (index >= newSort.length) {
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
      if (index === -1) return prev;
      let sort = [...prev];
      sort.splice(index, 1);
      sort.splice(index + (direction === 'up' ? -1 : 1), 0, prev[index]);
      return sort;
    });
  }, []);

  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      divRef.current = node;
      changePosition(node);
    },
    [changePosition]
  );

  const focussedRef = useRef<boolean>(false);
  const dropdownRef = useCallback((node: HTMLDivElement | null) => {
    if (node && !focussedRef.current) {
      const child = node.children[0] as HTMLDivElement | undefined;
      if (child) {
        child.focus();
        focussedRef.current = true;
      }
    }
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
        e.stopPropagation();
        if (e.key === 'Escape') {
          handleClose();
        } else if (e.key === 'Enter') {
          handleSave();
        }
      }}
    >
      <div className="mb-4 text-lg font-semibold">Sort</div>
      <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
        {sort.map((entry, index) => {
          const name = entry.column_index === -1 ? '' : (contextMenu.table?.columns[entry.column_index]?.name ?? '');
          const columns = name ? [name, ...availableColumns] : availableColumns;
          return (
            <TableSortEntry
              ref={dropdownRef}
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
      <div className="mt-4 flex w-full justify-end gap-2">
        <Button variant="secondary" onClick={handleClose}>
          Cancel
        </Button>
        <Button onClick={handleSave}>Apply</Button>
      </div>
    </div>
  );
};
