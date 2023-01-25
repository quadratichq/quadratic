import { ControlledMenu, MenuItem } from '@szhsin/react-menu';
import { MenuState, MenuCloseEvent } from '@szhsin/react-menu/types';

import { copyToClipboard, pasteFromClipboard } from '../../../core/actions/clipboard';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { SheetController } from '../../../core/transaction/sheetController';

interface EventHandler<E> {
  (event: E): void;
}

interface RightClickMenuProps {
  state: MenuState | undefined;
  anchorPoint: {
    x: number;
    y: number;
  };
  onClose: EventHandler<MenuCloseEvent>;
  interactionState: GridInteractionState;
  sheet_controller: SheetController;
}

export const RightClickMenu = (props: RightClickMenuProps) => {
  return (
    <>
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
            copyToClipboard(
              props.sheet_controller,
              props.interactionState.multiCursorPosition.originPosition,
              props.interactionState.multiCursorPosition.terminalPosition
            );
          }}
        >
          Copy
        </MenuItem>
        <MenuItem
          onClick={() => {
            pasteFromClipboard(props.sheet_controller, props.interactionState.cursorPosition);
          }}
        >
          Paste
        </MenuItem>
      </ControlledMenu>
    </>
  );
};
