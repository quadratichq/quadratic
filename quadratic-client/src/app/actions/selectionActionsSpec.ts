import { Action } from '@/app/actions/actions';
import type { ActionSpecRecord } from '@/app/actions/actionsSpec';
import { sheets } from '@/app/grid/controller/Sheets';

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
  | Action.GotoA1
  | Action.GotoBottomRight
  | Action.GotoRowStart
  | Action.GotoRowEnd
  | Action.SelectPageDown
  | Action.SelectPageUp
  | Action.SelectGotoRowStart
  | Action.SelectGotoRowEnd
>;

export const selectionActionsSpec: SelectionActionSpec = {
  [Action.SelectAll]: {
    label: () => 'Select all',
    run: () => {
      sheets.sheet.cursor.selectAll();
    },
  },
  [Action.SelectColumn]: {
    label: () => 'Select column',
    run: () => {
      sheets.sheet.cursor.setColumnsSelected();
    },
  },
  [Action.SelectRow]: {
    label: () => 'Select row',
    run: () => {
      sheets.sheet.cursor.setRowsSelected();
    },
  },
  [Action.MoveCursorUp]: {
    label: () => 'Move cursor up',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.JumpCursorContentTop]: {
    label: () => 'Jump cursor content top',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.ExpandSelectionUp]: {
    label: () => 'Expand selection up',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.ExpandSelectionContentTop]: {
    label: () => 'Expand selection content top',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.MoveCursorDown]: {
    label: () => 'Move cursor down',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.JumpCursorContentBottom]: {
    label: () => 'Jump cursor content bottom',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.ExpandSelectionDown]: {
    label: () => 'Expand selection down',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.ExpandSelectionContentBottom]: {
    label: () => 'Expand selection content bottom',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.MoveCursorLeft]: {
    label: () => 'Move cursor left',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.JumpCursorContentLeft]: {
    label: () => 'Jump cursor content left',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.ExpandSelectionLeft]: {
    label: () => 'Expand selection left',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.ExpandSelectionContentLeft]: {
    label: () => 'Expand selection content left',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.MoveCursorLeftWithSelection]: {
    label: () => 'Move cursor left with selection',
    run: () => {
      // handled in keyboardPosition
      // todo: probably rethink how we handle keyboard shortcuts
    },
  },
  [Action.MoveCursorRight]: {
    label: () => 'Move cursor right',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.JumpCursorContentRight]: {
    label: () => 'Jump cursor content right',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.ExpandSelectionRight]: {
    label: () => 'Expand selection right',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.ExpandSelectionContentRight]: {
    label: () => 'Expand selection content right',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.MoveCursorRightWithSelection]: {
    label: () => 'Move cursor right with selection',
    run: () => {
      // handled in keyboardPosition
      // todo: probably rethink how we handle keyboard shortcuts
    },
  },
  [Action.GotoA1]: {
    label: () => 'Goto A1',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.GotoBottomRight]: {
    label: () => 'Goto bottom right',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.GotoRowStart]: {
    label: () => 'Goto row start',
    run: () => sheets.sheet.cursor.moveTo(1, sheets.sheet.cursor.position.y, { checkForTableRef: true }),
  },
  [Action.GotoRowEnd]: {
    label: () => 'Goto row end',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.SelectPageDown]: {
    label: () => 'Select page down',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.SelectPageUp]: {
    label: () => 'Select page up',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.SelectGotoRowStart]: {
    label: () => 'Select goto row start',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.SelectGotoRowEnd]: {
    label: () => 'Select goto row end',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
};
