import { events } from '@/app/events/events';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { JsUpdateCodeCell } from '@/app/quadratic-core-types';
import { useEffect } from 'react';

export const useSpillErrorDetection = () => {
  // Listen for code cell updates to detect new spill errors and automatically show hover
  useEffect(() => {
    const handleUpdateCodeCells = (updateCodeCells: JsUpdateCodeCell[]) => {
      updateCodeCells.forEach((update) => {
        const codeCell = update.render_code_cell;
        if (codeCell && codeCell.state === 'SpillError' && codeCell.spill_error) {
          // Automatically trigger the hover cell for this spill error
          setTimeout(() => {
            events.emit('hoverCell', codeCell);
          }, 100); // Small delay to ensure the cell is rendered
        }
      });
    };

    events.on('updateCodeCells', handleUpdateCodeCells);
    return () => {
      events.off('updateCodeCells', handleUpdateCodeCells);
    };
  }, []);

  // Also check for spill errors after transactions complete
  useEffect(() => {
    const handleTransactionEnd = () => {
      // Small delay to ensure all updates are processed
      setTimeout(() => {
        // Check if there are any spill error cells currently visible
        if (content.cellsSheets.current) {
          const tables = content.cellsSheets.current.tables;

          // Check single cell tables first
          const visibleBounds = pixiApp.getVisibleRectangle();
          const singleCellTables = tables.getSingleCellTablesInRectangle(visibleBounds);
          const spillErrorSingleCells = singleCellTables.filter(
            (cell) => cell.state === 'SpillError' && cell.spill_error
          );

          if (spillErrorSingleCells.length > 0) {
            events.emit('hoverCell', spillErrorSingleCells[0]);
            return;
          }

          // Check large tables
          const largeTables = tables.getLargeTablesInRect(visibleBounds);
          const spillErrorLargeTables = largeTables.filter(
            (table) => table.codeCell.state === 'SpillError' && table.codeCell.spill_error
          );

          if (spillErrorLargeTables.length > 0) {
            events.emit('hoverCell', spillErrorLargeTables[0].codeCell);
          }
        }
      }, 200);
    };

    events.on('transactionEnd', handleTransactionEnd);
    return () => {
      events.off('transactionEnd', handleTransactionEnd);
    };
  }, []);
};
