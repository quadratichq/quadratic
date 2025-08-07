//! This handles the keyboard events for the inline editor. In particular, it
//! handles when the cursorIsMoving outside of the inline formula edit box.

import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { getSingleSelection } from '@/app/grid/sheet/selection';
import { inlineEditorFormula } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorFormula';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { inlineEditorMonaco } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorMonaco';
import { keyboardDropdown } from '@/app/gridGL/interaction/keyboard/keyboardDropdown';
import { keyboardPosition } from '@/app/gridGL/interaction/keyboard/keyboardPosition';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

export enum CursorMode {
  Enter,
  Edit,
}

class InlineEditorKeyboard {
  cursorMode: CursorMode = CursorMode.Enter;

  private handleArrowHorizontal = async (isRight: boolean, e: KeyboardEvent) => {
    // formula
    if (inlineEditorHandler.isEditingFormula()) {
      if (inlineEditorHandler.cursorIsMoving) {
        e.stopPropagation();
        e.preventDefault();
        keyboardPosition(e);
      } else if (this.cursorMode === CursorMode.Enter) {
        const column = inlineEditorMonaco.getCursorColumn();
        e.stopPropagation();
        e.preventDefault();
        if (inlineEditorFormula.wantsCellRef()) {
          inlineEditorHandler.cursorIsMoving = true;
          inlineEditorFormula.addInsertingCells(column);
          keyboardPosition(e);
        }
        // if we're not moving and the formula is valid, close the editor
        else if (!(await this.handleValidationError())) {
          inlineEditorHandler.close({ deltaX: isRight ? 1 : -1 });
        }
      }
    }
    // text
    else {
      if (this.cursorMode === CursorMode.Enter) {
        e.stopPropagation();
        e.preventDefault();
        if (!(await this.handleValidationError())) {
          inlineEditorHandler.close({ deltaX: isRight ? 1 : -1 });
        }
      }
    }
  };

  private handleArrowVertical = async (isDown: boolean, e: KeyboardEvent) => {
    // if dropdown is showing, then we let dropdown handle the vertical arrow keys
    if (pixiAppSettings.editorInteractionState.annotationState === 'dropdown') {
      keyboardDropdown(e);
      e.stopPropagation();
      e.preventDefault();
      return;
    }

    // formula
    if (inlineEditorHandler.isEditingFormula()) {
      e.stopPropagation();
      e.preventDefault();
      if (inlineEditorHandler.cursorIsMoving) {
        keyboardPosition(e);
      } else if (this.cursorMode === CursorMode.Enter) {
        // If we're not moving and the formula doesn't want a cell reference,
        // close the editor. We can't just use "is the formula syntactically
        // valid" because many formulas are syntactically valid even though
        // it's obvious the user wants to insert a cell reference. For
        // example, `SUM(,)` with the cursor to the left of the comma.
        if (inlineEditorFormula.wantsCellRef()) {
          const location = inlineEditorHandler.location;
          if (!location) {
            throw new Error('Expected inlineEditorHandler.location to be defined in keyDown');
          }
          const column = inlineEditorMonaco.getCursorColumn();
          inlineEditorFormula.addInsertingCells(column);
          inlineEditorHandler.cursorIsMoving = true;
          keyboardPosition(e);
        } else {
          if (!(await this.handleValidationError())) {
            inlineEditorHandler.close({ deltaY: isDown ? 1 : -1 });
          }
          return;
        }
      }
    }
    // text
    else {
      if (this.cursorMode === CursorMode.Enter) {
        e.stopPropagation();
        e.preventDefault();
        if (!(await this.handleValidationError())) {
          inlineEditorHandler.close({ deltaY: isDown ? 1 : -1 });
        }
      }
    }
  };

  // Checks and handles validation errors when the user leaves the current cell.
  private async handleValidationError(): Promise<boolean> {
    const validationError = await inlineEditorHandler.validateInput();
    if (validationError && inlineEditorHandler.location) {
      const value = inlineEditorMonaco.get();
      const location = inlineEditorHandler.location;
      events.emit('hoverCell', {
        x: location.x,
        y: location.y,
        validationId: validationError,
        value,
      });
      return true;
    }
    return false;
  }

  toggleArrowMode = () => {
    pixiAppSettings.setInlineEditorState?.((prev) => ({
      ...prev,
      editMode: !prev.editMode,
    }));
  };

  // Keyboard event for inline editor (via either Monaco's keyDown event or,
  // when on a different sheet, via window's keyDown listener).
  keyDown = async (e: KeyboardEvent) => {
    events.emit('hoverCell');

    if (
      inlineEditorMonaco.autocompleteShowingList &&
      ['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'].includes(e.key)
    ) {
      events.emit('suggestionDropdownKeyboard', e.key as 'ArrowDown' | 'ArrowUp' | 'Enter' | 'Escape' | 'Tab');
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const position = inlineEditorMonaco.getPosition();
    if (e.code === 'Equal' && position.lineNumber === 1 && position.column === 1) {
      pixiAppSettings.setInlineEditorState?.((prev) => ({
        ...prev,
        editMode: false,
      }));
    }

    // Escape key
    if (matchShortcut(Action.CloseInlineEditor, e)) {
      e.stopPropagation();
      if (inlineEditorHandler.cursorIsMoving) {
        inlineEditorHandler.cursorIsMoving = false;
        inlineEditorFormula.removeInsertingCells();
        this.resetKeyboardPosition();
      } else {
        inlineEditorHandler.close({ cancel: true });
      }
    }

    // Space key
    else if (matchShortcut(Action.GridPanMode, e)) {
      e.stopPropagation();
    }

    // Enter key
    else if (matchShortcut(Action.SaveInlineEditor, e)) {
      e.stopPropagation();
      e.preventDefault();
      if (!(await this.handleValidationError())) {
        inlineEditorHandler.close({ deltaY: 1 });
      }
    }

    // Shift+Enter key
    else if (matchShortcut(Action.SaveInlineEditorMoveUp, e)) {
      e.stopPropagation();
      e.preventDefault();
      if (!(await this.handleValidationError())) {
        inlineEditorHandler.close({ deltaY: -1 });
      }
    }

    // toggle arrow mode
    else if (matchShortcut(Action.ToggleArrowMode, e)) {
      e.stopPropagation();
      this.toggleArrowMode();
    }

    // Tab key
    else if (matchShortcut(Action.SaveInlineEditorMoveRight, e)) {
      if (inlineEditorMonaco.autocompleteSuggestionShowing) {
        return;
      } else {
        e.stopPropagation();
        e.preventDefault();
        if (!(await this.handleValidationError())) {
          inlineEditorHandler.close({ deltaX: 1 });
        }
      }
    }

    // Shift+Tab key
    else if (matchShortcut(Action.SaveInlineEditorMoveLeft, e)) {
      e.stopPropagation();
      e.preventDefault();
      if (!(await this.handleValidationError())) {
        inlineEditorHandler.close({ deltaX: -1 });
      }
    }

    // Arrow up
    else if (
      matchShortcut(Action.MoveCursorUp, e) ||
      matchShortcut(Action.ExpandSelectionUp, e) ||
      matchShortcut(Action.JumpCursorContentTop, e) ||
      matchShortcut(Action.ExpandSelectionContentTop, e)
    ) {
      this.handleArrowVertical(false, e);
    }

    // Arrow down
    else if (
      matchShortcut(Action.MoveCursorDown, e) ||
      matchShortcut(Action.ExpandSelectionDown, e) ||
      matchShortcut(Action.JumpCursorContentBottom, e) ||
      matchShortcut(Action.ExpandSelectionContentBottom, e)
    ) {
      this.handleArrowVertical(true, e);
    }

    // Arrow left
    else if (
      matchShortcut(Action.MoveCursorLeft, e) ||
      matchShortcut(Action.ExpandSelectionLeft, e) ||
      matchShortcut(Action.JumpCursorContentLeft, e) ||
      matchShortcut(Action.ExpandSelectionContentLeft, e)
    ) {
      this.handleArrowHorizontal(false, e);
    }

    // Arrow right
    else if (
      matchShortcut(Action.MoveCursorRight, e) ||
      matchShortcut(Action.ExpandSelectionRight, e) ||
      matchShortcut(Action.JumpCursorContentRight, e) ||
      matchShortcut(Action.ExpandSelectionContentRight, e)
    ) {
      this.handleArrowHorizontal(true, e);
    }

    // handle ShiftKey when cursorIsMoving (do nothing or it adds additional references)
    else if (e.code.includes('Shift')) {
      if (inlineEditorHandler.cursorIsMoving) {
        e.stopPropagation();
      }
    }

    // Backspace key cancels cursorIsMoving and removes any inserted cells.
    else if (matchShortcut(Action.RemoveInsertedCells, e)) {
      if (inlineEditorHandler.cursorIsMoving) {
        e.stopPropagation();
        e.preventDefault();
        inlineEditorFormula.removeInsertingCells();
        inlineEditorFormula.endInsertingCells();
        this.resetKeyboardPosition();
      }

      // F4 key toggles the current reference between absolute and relative
    } else if (e.code === 'F4') {
      e.preventDefault();
      e.stopPropagation();
      if (inlineEditorHandler.formula) {
        inlineEditorFormula.toggleReference();
      }
    }

    // toggle italics
    else if (matchShortcut(Action.ToggleItalic, e)) {
      e.preventDefault();
      e.stopPropagation();
      inlineEditorHandler.toggleItalics();
      if (inlineEditorHandler.location) {
        const selection = getSingleSelection(
          inlineEditorHandler.location.sheetId,
          inlineEditorHandler.location.x,
          inlineEditorHandler.location.y
        );
        quadraticCore.setItalic(selection, !!inlineEditorHandler.temporaryItalic);
      }
    }

    // toggle bold
    else if (matchShortcut(Action.ToggleBold, e)) {
      e.preventDefault();
      e.stopPropagation();
      if (inlineEditorHandler.location) {
        inlineEditorHandler.toggleBold();
        const selection = getSingleSelection(
          inlineEditorHandler.location.sheetId,
          inlineEditorHandler.location.x,
          inlineEditorHandler.location.y
        );
        quadraticCore.setBold(selection, !!inlineEditorHandler.temporaryBold);
      }
    }

    // toggle underline
    else if (matchShortcut(Action.ToggleUnderline, e)) {
      e.preventDefault();
      e.stopPropagation();
      if (inlineEditorHandler.location) {
        inlineEditorHandler.toggleUnderline();
        const selection = getSingleSelection(
          inlineEditorHandler.location.sheetId,
          inlineEditorHandler.location.x,
          inlineEditorHandler.location.y
        );
        quadraticCore.setUnderline(selection, !!inlineEditorHandler.temporaryUnderline);
      }
    }

    // toggle strike-through
    else if (matchShortcut(Action.ToggleStrikeThrough, e)) {
      e.preventDefault();
      e.stopPropagation();
      if (inlineEditorHandler.location) {
        inlineEditorHandler.toggleStrikeThrough();
        const selection = getSingleSelection(
          inlineEditorHandler.location.sheetId,
          inlineEditorHandler.location.x,
          inlineEditorHandler.location.y
        );
        quadraticCore.setStrikeThrough(selection, !!inlineEditorHandler.temporaryStrikeThrough);
      }
    }

    // show go to menu
    else if (matchShortcut(Action.ShowGoToMenu, e)) {
      e.stopPropagation();
      e.preventDefault();
      inlineEditorHandler.close({}).then(() => {
        defaultActionSpec[Action.ShowGoToMenu].run();
      });
    }

    // show find in current sheet
    else if (matchShortcut(Action.FindInCurrentSheet, e)) {
      e.stopPropagation();
      e.preventDefault();
      inlineEditorHandler.close({}).then(() => {
        defaultActionSpec[Action.FindInCurrentSheet].run();
      });
    }

    // show command palette
    else if (matchShortcut(Action.ShowCommandPalette, e)) {
      e.stopPropagation();
      e.preventDefault();
      inlineEditorHandler.close({}).then(() => {
        defaultActionSpec[Action.ShowCommandPalette].run();
      });
    }

    // trigger cell type menu
    else if (matchShortcut(Action.ShowCellTypeMenu, e) && inlineEditorMonaco.get().length === 0) {
      e.preventDefault();
      e.stopPropagation();
      pixiAppSettings.changeInput(false);
      const cursor = sheets.sheet.cursor.position;
      pixiAppSettings.setEditorInteractionState?.({
        ...pixiAppSettings.editorInteractionState,
        showCellTypeMenu: true,
      });
      pixiAppSettings.setCodeEditorState?.({
        ...pixiAppSettings.codeEditorState,
        initialCode: '',
        codeCell: {
          sheetId: sheets.current,
          pos: { x: cursor.x, y: cursor.y },
          language: pixiAppSettings.codeEditorState.codeCell.language,
          lastModified: pixiAppSettings.codeEditorState.codeCell.lastModified,
        },
      });
    } else if (matchShortcut(Action.InsertToday, e)) {
      const today = new Date();
      // todo: this should be based on locale (maybe?)
      const formattedDate = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;
      inlineEditorMonaco.insertTextAtCursor(formattedDate);
    } else if (matchShortcut(Action.InsertTodayTime, e)) {
      const today = new Date();
      const formattedTime = `${today.getHours()}:${today.getMinutes()}:${today.getSeconds()}`;
      inlineEditorMonaco.insertTextAtCursor(formattedTime);
    }

    // Fallback for all other keys (used to end cursorIsMoving and return
    // control to the formula box)
    else {
      // need to ignore meta and control to allow for multi-selection
      if (!['Meta', 'Control'].includes(e.key) && inlineEditorHandler.cursorIsMoving) {
        inlineEditorFormula.endInsertingCells();
        this.resetKeyboardPosition();
        if (sheets.current !== inlineEditorHandler.location?.sheetId) {
          inlineEditorMonaco.sendKeyboardEvent(e);
          inlineEditorHandler.sendMultiplayerUpdate();
        } else {
          inlineEditorMonaco.focus();
        }
      }
    }
  };

  // Resets the keyboard position after cursorIsMoving has ended.
  resetKeyboardPosition(skipFocus?: boolean) {
    const location = inlineEditorHandler.location;
    if (!location) return;

    inlineEditorHandler.cursorIsMoving = false;
    pixiApp.cellHighlights.clearSelectedCell();
    const editingSheet = sheets.getById(location.sheetId);
    if (!editingSheet) {
      throw new Error('Expected editingSheet to be defined in resetKeyboardPosition');
    }
    editingSheet.cursor.moveTo(location.x, location.y, { checkForTableRef: true });
    if (sheets.current !== location.sheetId) {
      sheets.current = location.sheetId;

      if (!skipFocus) {
        // We need the timeout to wait for the sheet to change (and all events to
        // handle) before we can focus on the inline editor and set cursorIsMoving
        // to false.
        setTimeout(() => {
          inlineEditorMonaco.focus();
        }, 0);
      }
    }
  }
}

export const inlineEditorKeyboard = new InlineEditorKeyboard();
