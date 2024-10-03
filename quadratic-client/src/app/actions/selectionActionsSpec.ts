import { Action } from '@/app/actions/actions';
import { ActionSpecRecord } from '@/app/actions/actionsSpec';
import { sheets } from '@/app/grid/controller/Sheets';
import { selectAllCells, selectColumns, selectRows } from '@/app/gridGL/helpers/selectCells';

type SelectionActionSpec = Pick<
  ActionSpecRecord,
  | Action.SelectAll
  | Action.SelectColumn
  | Action.SelectRow
  | Action.MoveCursorUp
  | Action.JumpCursorContentTop
  | Action.ExpandSelectionUp
  | Action.ExpandSelectionContentTop
  | Action.MoveCursorDown
  | Action.JumpCursorContentBottom
  | Action.ExpandSelectionDown
  | Action.ExpandSelectionContentBottom
  | Action.MoveCursorLeft
  | Action.JumpCursorContentLeft
  | Action.ExpandSelectionLeft
  | Action.ExpandSelectionContentLeft
  | Action.MoveCursorLeftWithSelection
  | Action.MoveCursorRight
  | Action.JumpCursorContentRight
  | Action.ExpandSelectionRight
  | Action.ExpandSelectionContentRight
  | Action.MoveCursorRightWithSelection
  | Action.GotoA0
  | Action.GotoBottomRight
  | Action.GotoRowStart
  | Action.GotoRowEnd
>;

export const selectionActionsSpec: SelectionActionSpec = {
  [Action.SelectAll]: {
    label: 'Select all',
    run: () => {
      selectAllCells();
    },
  },
  [Action.SelectColumn]: {
    label: 'Select column',
    run: () => {
      const cursor = sheets.sheet.cursor;
      if (cursor.columnRow?.all || cursor.columnRow?.rows?.length) {
        selectAllCells();
      } else {
        let columns = new Set<number>(cursor.columnRow?.columns);
        columns.add(cursor.cursorPosition.x);
        cursor.multiCursor?.forEach((rect) => {
          for (let x = rect.x; x < rect.x + rect.width; x++) {
            columns.add(x);
          }
        });
        selectColumns(Array.from(columns), cursor.cursorPosition.x);
      }
    },
  },
  [Action.SelectRow]: {
    label: 'Select row',
    run: () => {
      const cursor = sheets.sheet.cursor;
      if (cursor.columnRow?.all || cursor.columnRow?.columns?.length) {
        selectAllCells();
      } else {
        let row = new Set<number>(cursor.columnRow?.rows);
        row.add(cursor.cursorPosition.y);
        cursor.multiCursor?.forEach((rect) => {
          for (let y = rect.y; y < rect.y + rect.height; y++) {
            row.add(y);
          }
        });
        selectRows(Array.from(row), cursor.cursorPosition.y);
      }
    },
  },
  [Action.MoveCursorUp]: {
    label: 'Move cursor up',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.JumpCursorContentTop]: {
    label: 'Jump cursor content top',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.ExpandSelectionUp]: {
    label: 'Expand selection up',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.ExpandSelectionContentTop]: {
    label: 'Expand selection content top',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.MoveCursorDown]: {
    label: 'Move cursor down',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.JumpCursorContentBottom]: {
    label: 'Jump cursor content bottom',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.ExpandSelectionDown]: {
    label: 'Expand selection down',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.ExpandSelectionContentBottom]: {
    label: 'Expand selection content bottom',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.MoveCursorLeft]: {
    label: 'Move cursor left',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.JumpCursorContentLeft]: {
    label: 'Jump cursor content left',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.ExpandSelectionLeft]: {
    label: 'Expand selection left',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.ExpandSelectionContentLeft]: {
    label: 'Expand selection content left',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.MoveCursorLeftWithSelection]: {
    label: 'Move cursor left with selection',
    run: () => {
      const cursor = sheets.sheet.cursor;
      const cursorPosition = cursor.cursorPosition;
      cursor.changePosition({
        keyboardMovePosition: {
          x: cursorPosition.x - 1,
          y: cursorPosition.y,
        },
        cursorPosition: {
          x: cursorPosition.x - 1,
          y: cursorPosition.y,
        },
      });
    },
  },
  [Action.MoveCursorRight]: {
    label: 'Move cursor right',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.JumpCursorContentRight]: {
    label: 'Jump cursor content right',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.ExpandSelectionRight]: {
    label: 'Expand selection right',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.ExpandSelectionContentRight]: {
    label: 'Expand selection content right',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.MoveCursorRightWithSelection]: {
    label: 'Move cursor right with selection',
    run: () => {
      const cursor = sheets.sheet.cursor;
      const cursorPosition = cursor.cursorPosition;
      cursor.changePosition({
        keyboardMovePosition: {
          x: cursorPosition.x + 1,
          y: cursorPosition.y,
        },
        cursorPosition: {
          x: cursorPosition.x + 1,
          y: cursorPosition.y,
        },
      });
    },
  },
  [Action.GotoA0]: {
    label: 'Goto A0',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.GotoBottomRight]: {
    label: 'Goto bottom right',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.GotoRowStart]: {
    label: 'Goto row start',
    run: () => {
      sheets.sheet.cursor.changePosition({
        columnRow: null,
        cursorPosition: { x: 1, y: sheets.sheet.cursor.cursorPosition.y },
      });
    },
  },
  [Action.GotoRowEnd]: {
    label: 'Goto row end',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
};
