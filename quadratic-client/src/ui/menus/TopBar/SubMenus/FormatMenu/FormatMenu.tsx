import {
  BorderNoneIcon,
  FontBoldIcon,
  FontItalicIcon,
  PaintBucketIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  TextColorIcon,
  TextIcon,
  TextNoneIcon,
} from '@/ui/icons/radix';
import { Menu, MenuChangeEvent, MenuDivider, MenuItem, SubMenu } from '@szhsin/react-menu';
import { useCallback } from 'react';
import { focusGrid } from '../../../../../helpers/focusGrid';
import { KeyboardSymbols } from '../../../../../helpers/keyboardSymbols';
import { QColorPicker } from '../../../../components/qColorPicker';
import { MenuLineItem } from '../../MenuLineItem';
import { TopBarMenuItem } from '../../TopBarMenuItem';
import {
  clearFormattingAndBorders,
  setAlignment,
  setBold,
  setFillColor,
  setItalic,
  setTextColor,
} from '../formatCells';
import './formatMenuStyles.scss';
import { useGetBorderMenu } from './useGetBorderMenu';

export const FormatMenu = () => {
  // todo!!!
  const formatPrimaryCell = { bold: false, italic: false };

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
          <TextIcon className="h-5 w-5" />
        </TopBarMenuItem>
      )}
    >
      <MenuItem onClick={() => setBold(!(formatPrimaryCell?.bold === true))}>
        <MenuLineItem primary="Bold" secondary={KeyboardSymbols.Command + 'B'} Icon={FontBoldIcon} />
      </MenuItem>
      <MenuItem onClick={() => setItalic(!(formatPrimaryCell?.italic === true))}>
        <MenuLineItem primary="Italic" secondary={KeyboardSymbols.Command + 'I'} Icon={FontItalicIcon} />
      </MenuItem>
      <SubMenu
        className="color-picker-submenu"
        id="TextColorMenuID"
        label={<MenuLineItem primary="Text color" Icon={TextColorIcon} />}
      >
        <QColorPicker onChangeComplete={setTextColor} onClear={() => setTextColor()} />
      </SubMenu>

      <MenuDivider />
      <MenuItem onClick={() => setAlignment('left')}>
        <MenuLineItem primary="Left" Icon={TextAlignLeftIcon} secondary="" />
      </MenuItem>
      <MenuItem onClick={() => setAlignment('center')}>
        <MenuLineItem primary="Center" Icon={TextAlignRightIcon} />
      </MenuItem>
      <MenuItem onClick={() => setAlignment('right')}>
        <MenuLineItem primary="Right" Icon={TextAlignCenterIcon} />
      </MenuItem>

      <MenuDivider />
      <SubMenu
        className="color-picker-submenu"
        id="FillColorMenuID"
        label={<MenuLineItem primary="Fill color" Icon={PaintBucketIcon} />}
      >
        <QColorPicker onChangeComplete={setFillColor} onClear={() => setFillColor()} />
      </SubMenu>

      <SubMenu label={<MenuLineItem primary="Border" Icon={BorderNoneIcon} />}>{borders}</SubMenu>

      <MenuDivider />
      <MenuItem onClick={clearFormattingAndBorders}>
        <MenuLineItem primary="Clear formatting" secondary={KeyboardSymbols.Command + '\\'} Icon={TextNoneIcon} />
      </MenuItem>
    </Menu>
  );
};
