import { ControlledMenu, MenuItem } from '@szhsin/react-menu';
import { MenuState, MenuCloseEvent } from '@szhsin/react-menu/types';

import { copyToClipboard, cutToClipboard, pasteFromClipboard } from '../../../core/actions/clipboard';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { SheetController } from '../../../core/transaction/sheetController';
import { KeyboardShortcut } from '../KeyboardShortcut';
import { KeyboardSymbols } from '../../../helpers/keyboardSymbols';

interface EventHandler<E> {
  (event: E): void;
}

interface ContextMenuProps {
  state: MenuState | undefined;
  anchorPoint: {
    x: number;
    y: number;
  };
  onClose: EventHandler<MenuCloseEvent>;
  interactionState: GridInteractionState;
  sheet_controller: SheetController;
}

export const ContextMenu = (props: ContextMenuProps) => {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          zIndex: '1000',
          display: props.state === 'open' ? 'block' : 'none',
        }}
        onClick={(event) => {
          props.onClose({ reason: 'blur' });
        }}
      ></div>
      <ControlledMenu
        state={props.state}
        anchorPoint={props.anchorPoint}
        onClose={props.onClose}
        menuStyles={{
          zIndex: '10000',
        }}
      >
        <MenuItem
          onClick={() => {
            cutToClipboard(
              props.sheet_controller,
              props.interactionState.multiCursorPosition.originPosition,
              props.interactionState.multiCursorPosition.terminalPosition
            );
          }}
        >
          <KeyboardShortcut text="Cut" shortcut="X" modifier={KeyboardSymbols.Command} />
        </MenuItem>
        <MenuItem
          onClick={() => {
            copyToClipboard(
              props.sheet_controller,
              props.interactionState.multiCursorPosition.originPosition,
              props.interactionState.multiCursorPosition.terminalPosition
            );
          }}
        >
          <KeyboardShortcut text="Copy" shortcut="C" modifier={KeyboardSymbols.Command} />
        </MenuItem>
        <MenuItem
          onClick={() => {
            pasteFromClipboard(props.sheet_controller, props.interactionState.cursorPosition);
          }}
        >
          <KeyboardShortcut text="Paste" shortcut="V" modifier={KeyboardSymbols.Command} />
        </MenuItem>
      </ControlledMenu>
    </>
  );
};
