//! This shows the grid heading context menu.

import { gridHeadingAtom } from '@/app/atoms/gridHeadingAtom';
import { deleteColumnRow, insertColumnRow } from '@/app/gridGL/HTMLGrid/actionColumnRow';
import { useHeadingSize } from '@/app/gridGL/HTMLGrid/useHeadingSize';
import { MenuLineItem } from '@/app/ui/menus/TopBar/MenuLineItem';
import { ControlledMenu, MenuItem } from '@szhsin/react-menu';
import { useCallback, useEffect } from 'react';
import { useRecoilState } from 'recoil';
import { pixiApp } from '../pixiApp/PixiApp';

export const GridHeadingContextMenu = () => {
  const [show, setShow] = useRecoilState(gridHeadingAtom);

  // we need to remove the adjustment for the headings, since it's added as part
  // of HTMLGridContainer's parent
  const { leftHeading, topHeading } = useHeadingSize();

  const onClose = useCallback(() => {
    setShow({ world: undefined, column: undefined, row: undefined });
  }, [setShow]);

  useEffect(() => {
    pixiApp.viewport.on('moved', onClose);
    pixiApp.viewport.on('zoomed', onClose);

    return () => {
      pixiApp.viewport.off('moved', onClose);
      pixiApp.viewport.off('zoomed', onClose);
    };
  }, [onClose]);

  if (!show?.world) return null;

  const item = show.column ? 'column' : 'row';
  const dir = show.column ? ['to the left', 'to the right'] : ['above', 'below'];

  return (
    <ControlledMenu
      state={'open'}
      onClose={onClose}
      anchorPoint={{ x: show.world.x + leftHeading, y: show.world.y + topHeading + 50 }}
      menuStyle={{ padding: '2px 0', color: 'inherit' }}
    >
      <MenuItem onClick={() => insertColumnRow(show.column, show.row, -1)}>
        <MenuLineItem primary={`Insert ${item} ${dir[0]}`} />
      </MenuItem>
      <MenuItem onClick={() => insertColumnRow(show.column, show.row, 0)}>
        <MenuLineItem primary={`Insert ${item} ${dir[1]}`} />
      </MenuItem>
      <MenuItem onClick={() => deleteColumnRow(show.column, show.row)}>
        <MenuLineItem primary={`Delete ${item}`} />
      </MenuItem>
    </ControlledMenu>
  );
};
