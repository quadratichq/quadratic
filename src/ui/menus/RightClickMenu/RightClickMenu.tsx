import { ControlledMenu, MenuItem, MenuDivider } from '@szhsin/react-menu';
import { MenuState, MenuCloseEvent } from '@szhsin/react-menu/types';

import {
  copyToClipboard,
  pasteFromClipboard,
} from '../../../core/actions/clipboard';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { deleteCellsRange } from '../../../core/actions/deleteCellsRange';

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
}

export const RightClickMenu = (props: RightClickMenuProps) => {
  return (
    <ControlledMenu
      state={props.state}
      anchorPoint={props.anchorPoint}
      onClose={props.onClose}
    >
      <MenuItem
        onClick={() => {
          copyToClipboard(
            props.interactionState.multiCursorPosition.originPosition,
            props.interactionState.multiCursorPosition.terminalPosition
          );
        }}
      >
        Copy
      </MenuItem>
      <MenuItem
        onClick={() => {
          pasteFromClipboard(props.interactionState.cursorPosition);
        }}
      >
        Paste
      </MenuItem>
      <MenuDivider />
      <MenuItem
        onClick={() => {
          deleteCellsRange(
            props.interactionState.multiCursorPosition.originPosition,
            props.interactionState.multiCursorPosition.terminalPosition
          );
        }}
      >
        Delete Selection
      </MenuItem>
    </ControlledMenu>
  );
};
