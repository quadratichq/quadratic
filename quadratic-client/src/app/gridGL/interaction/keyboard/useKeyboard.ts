import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { keyboardCell } from '@/app/gridGL/interaction/keyboard/keyboardCell';
import { keyboardClipboard } from '@/app/gridGL/interaction/keyboard/keyboardClipboard';
import { keyboardCode } from '@/app/gridGL/interaction/keyboard/keyboardCode';
import { keyboardDropdown } from '@/app/gridGL/interaction/keyboard/keyboardDropdown';
import { keyboardLink } from '@/app/gridGL/interaction/keyboard/keyboardLink';
import { keyboardPosition } from '@/app/gridGL/interaction/keyboard/keyboardPosition';
import { keyboardSearch } from '@/app/gridGL/interaction/keyboard/keyboardSearch';
import { keyboardSelect } from '@/app/gridGL/interaction/keyboard/keyboardSelect';
import { keyboardUndoRedo } from '@/app/gridGL/interaction/keyboard/keyboardUndoRedo';
import { keyboardViewport } from '@/app/gridGL/interaction/keyboard/keyboardViewport';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { Size } from '@/app/gridGL/types/size';

export const pixiKeyboardCanvasProps: { headerSize: Size } = { headerSize: { width: 0, height: 0 } };

export const useKeyboard = (): {
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  onKeyUp: (event: React.KeyboardEvent<HTMLElement>) => void;
} => {
  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (pixiAppSettings.input.show && inlineEditorHandler.isOpen()) return;
    if (
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
    if (keyboardLink(event)) {
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
