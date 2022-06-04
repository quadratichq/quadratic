import { ControlledMenu, MenuItem, MenuDivider } from '@szhsin/react-menu';

import { MenuState, MenuCloseEvent } from '@szhsin/react-menu/types';

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
}

export const RightClickMenu = (props: RightClickMenuProps) => {
  return (
    <ControlledMenu
      state={props.state}
      anchorPoint={props.anchorPoint}
      onClose={props.onClose}
    >
      <MenuItem>Copy</MenuItem>
      <MenuItem>Paste</MenuItem>
      <MenuDivider />
      <MenuItem>Delete Selection</MenuItem>
    </ControlledMenu>
  );
};
