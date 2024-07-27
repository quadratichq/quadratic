import { Menu, MenuDivider, MenuItem, SubMenu } from '@szhsin/react-menu';
import type { MenuChangeEvent } from '@szhsin/react-menu';
import { useCallback } from 'react';

import { focusGrid } from '@/app/helpers/focusGrid';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { QColorPicker } from '@/app/ui/components/qColorPicker';
import {
  BorderNoneIcon,
  FontBoldIcon,
  FontItalicIcon,
  PaintBucketIcon,
  PaletteOutlined,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  TextColorIcon,
  TextNoneIcon,
} from '@/app/ui/icons';
import { MenuLineItem } from '@/app/ui/menus/TopBar/MenuLineItem';
import {
  clearFillColor,
  clearFormattingAndBorders,
  setAlignment,
  setBold,
  setFillColor,
  setItalic,
  setTextColor,
} from '@/app/ui/menus/TopBar/SubMenus/formatCells';
import '@/app/ui/menus/TopBar/SubMenus/FormatMenu/formatMenuStyles.scss';
import { useGetBorderMenu } from '@/app/ui/menus/TopBar/SubMenus/FormatMenu/useGetBorderMenu';
import { TopBarMenuItem } from '@/app/ui/menus/TopBar/TopBarMenuItem';

export const FormatMenu = () => {
  // focus canvas after the format menu closes
  const onMenuChange = useCallback((event: MenuChangeEvent) => {
    if (!event.open) focusGrid();
  }, []);

  const borders = useGetBorderMenu();

  return (
    <Menu
      onMenuChange={onMenuChange}
      menuButton={({ open }) => (
        <TopBarMenuItem title="Cell format" open={open}>
          <PaletteOutlined fontSize="small" />
        </TopBarMenuItem>
      )}
    >
      <MenuItem onClick={() => setBold()}>
        <MenuLineItem primary="Bold" secondary={KeyboardSymbols.Command + 'B'} icon={FontBoldIcon} />
      </MenuItem>
      <MenuItem onClick={() => setItalic()}>
        <MenuLineItem primary="Italic" secondary={KeyboardSymbols.Command + 'I'} icon={FontItalicIcon} />
      </MenuItem>
      <SubMenu
        className="color-picker-submenu"
        id="TextColorMenuID"
        label={<MenuLineItem primary="Text color" icon={TextColorIcon} />}
      >
        <QColorPicker onChangeComplete={setTextColor} onClear={() => setTextColor()} />
      </SubMenu>

      <MenuDivider />
      <MenuItem onClick={() => setAlignment('left')}>
        <MenuLineItem primary="Left" icon={TextAlignLeftIcon} secondary="" />
      </MenuItem>
      <MenuItem onClick={() => setAlignment('center')}>
        <MenuLineItem primary="Center" icon={TextAlignRightIcon} />
      </MenuItem>
      <MenuItem onClick={() => setAlignment('right')}>
        <MenuLineItem primary="Right" icon={TextAlignCenterIcon} />
      </MenuItem>

      <MenuDivider />
      <SubMenu
        className="color-picker-submenu"
        id="FillColorMenuID"
        label={<MenuLineItem primary="Fill color" icon={PaintBucketIcon} />}
      >
        <QColorPicker onChangeComplete={setFillColor} onClear={clearFillColor} />
      </SubMenu>

      <SubMenu label={<MenuLineItem primary="Border" icon={BorderNoneIcon} />}>{borders}</SubMenu>

      <MenuDivider />
      <MenuItem onClick={clearFormattingAndBorders}>
        <MenuLineItem primary="Clear formatting" secondary={KeyboardSymbols.Command + '\\'} icon={TextNoneIcon} />
      </MenuItem>
    </Menu>
  );
};
