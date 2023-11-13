import {
  BorderAll,
  FormatAlignCenter,
  FormatAlignLeft,
  FormatAlignRight,
  FormatBold,
  FormatClear,
  FormatColorFill,
  FormatColorText,
  FormatItalic,
  PaletteOutlined,
} from '@mui/icons-material';
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
          <PaletteOutlined fontSize="small"></PaletteOutlined>
        </TopBarMenuItem>
      )}
    >
      <MenuItem onClick={() => setBold(!(formatPrimaryCell?.bold === true))}>
        <MenuLineItem primary="Bold" secondary={KeyboardSymbols.Command + 'B'} Icon={FormatBold} />
      </MenuItem>
      <MenuItem onClick={() => setItalic(!(formatPrimaryCell?.italic === true))}>
        <MenuLineItem primary="Italic" secondary={KeyboardSymbols.Command + 'I'} Icon={FormatItalic} />
      </MenuItem>
      <SubMenu
        className="color-picker-submenu"
        id="TextColorMenuID"
        label={<MenuLineItem primary="Text color" Icon={FormatColorText} />}
      >
        <QColorPicker onChangeComplete={setTextColor} onClear={() => setTextColor()} />
      </SubMenu>

      <MenuDivider />
      <MenuItem onClick={() => setAlignment('left')}>
        <MenuLineItem primary="Left" Icon={FormatAlignLeft} secondary="" />
      </MenuItem>
      <MenuItem onClick={() => setAlignment('center')}>
        <MenuLineItem primary="Center" Icon={FormatAlignCenter} />
      </MenuItem>
      <MenuItem onClick={() => setAlignment('right')}>
        <MenuLineItem primary="Right" Icon={FormatAlignRight} />
      </MenuItem>

      <MenuDivider />
      <SubMenu
        className="color-picker-submenu"
        id="FillColorMenuID"
        label={<MenuLineItem primary="Fill color" Icon={FormatColorFill} />}
      >
        <QColorPicker onChangeComplete={setFillColor} onClear={() => setFillColor()} />
      </SubMenu>

      <SubMenu label={<MenuLineItem primary="Border" Icon={BorderAll} />}>{borders}</SubMenu>

      <MenuDivider />
      <MenuItem onClick={clearFormattingAndBorders}>
        <MenuLineItem primary="Clear formatting" secondary={KeyboardSymbols.Command + '\\'} Icon={FormatClear} />
      </MenuItem>
    </Menu>
  );
};
