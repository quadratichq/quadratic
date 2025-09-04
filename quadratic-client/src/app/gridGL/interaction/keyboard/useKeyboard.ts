import { Action } from '@/app/actions/actions';
import { gridToDataTable } from '@/app/actions/dataTableSpec';
import type { EditorInteractionState } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { keyboardCell } from '@/app/gridGL/interaction/keyboard/keyboardCell';
import { keyboardClipboard } from '@/app/gridGL/interaction/keyboard/keyboardClipboard';
import { keyboardCode } from '@/app/gridGL/interaction/keyboard/keyboardCode';
import { keyboardDropdown } from '@/app/gridGL/interaction/keyboard/keyboardDropdown';
import { keyboardLink } from '@/app/gridGL/interaction/keyboard/keyboardLink';
import { keyboardPanMode } from '@/app/gridGL/interaction/keyboard/keyboardPanMode';
import { keyboardPosition } from '@/app/gridGL/interaction/keyboard/keyboardPosition';
import { keyboardSearch } from '@/app/gridGL/interaction/keyboard/keyboardSearch';
import { keyboardSelect } from '@/app/gridGL/interaction/keyboard/keyboardSelect';
import { keyboardUndoRedo } from '@/app/gridGL/interaction/keyboard/keyboardUndoRedo';
import { keyboardViewport } from '@/app/gridGL/interaction/keyboard/keyboardViewport';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts';
import type { Size } from '@/app/shared/types/size';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useScheduledTasks } from '@/jotai/scheduledTasksAtom';

export interface IProps {
  editorInteractionState: EditorInteractionState;
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>;
}

export const pixiKeyboardCanvasProps: { headerSize: Size } = { headerSize: { width: 0, height: 0 } };

export const useKeyboard = (): {
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  onKeyUp: (event: React.KeyboardEvent<HTMLElement>) => void;
} => {
  const scheduledTasks = useScheduledTasks();

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if ((pixiAppSettings.input.show && inlineEditorHandler.isOpen()) || pixiAppSettings.isRenamingTable()) return;

    if (scheduledTasks.show && event.key === 'Escape') {
      scheduledTasks.closeScheduledTasks();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (
      keyboardPanMode(event) ||
      keyboardLink(event) ||
      keyboardViewport(event) ||
      keyboardSearch(event) ||
      keyboardClipboard(event) ||
      keyboardDropdown(event.nativeEvent) ||
      keyboardUndoRedo(event) ||
      keyboardSelect(event) ||
      keyboardCode(event) ||
      keyboardPosition(event.nativeEvent)
    ) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // todo: we need to reorganize this so we can handle shortcuts in keyboardCell when ctrl or meta is pressed
    // insert today's date if the inline editor is not open
    if (matchShortcut(Action.InsertToday, event)) {
      const sheet = sheets.sheet;
      const cursor = sheet.cursor;
      const today = new Date();
      const formattedDate = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;
      quadraticCore.setCellValue(sheet.id, cursor.position.x, cursor.position.y, formattedDate);
    } else if (matchShortcut(Action.InsertTodayTime, event)) {
      const sheet = sheets.sheet;
      const cursor = sheet.cursor;
      const today = new Date();
      const formattedTime = `${today.getHours()}:${today.getMinutes()}:${today.getSeconds()}`;
      quadraticCore.setCellValue(sheet.id, cursor.position.x, cursor.position.y, formattedTime);
    }

    if (matchShortcut(Action.GridToDataTable, event)) {
      gridToDataTable();
      return true;
    }

    // Prevent these commands if "command" key is being pressed
    if (event.metaKey || event.ctrlKey) {
      return;
    }

    if (keyboardCell(event)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  };

  const onKeyUp = (event: React.KeyboardEvent<HTMLElement>) => {
    if (keyboardPanMode(event) || keyboardLink(event)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  };

  return {
    onKeyDown,
    onKeyUp,
  };
};
