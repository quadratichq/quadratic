import './formatMenuStyles.scss';

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
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { Tooltip } from '@mui/material';
import Button from '@mui/material/Button';
import { Menu, MenuChangeEvent, MenuDivider, MenuItem, SubMenu } from '@szhsin/react-menu';
import '@szhsin/react-menu/dist/index.css';
import { useCallback } from 'react';
import { SheetController } from '../../../../../grid/controller/SheetController';
import { focusGrid } from '../../../../../helpers/focusGrid';
import { KeyboardSymbols } from '../../../../../helpers/keyboardSymbols';
import { QColorPicker } from '../../../../components/qColorPicker';
import { MenuLineItem } from '../../MenuLineItem';
import { useClearAllFormatting } from '../useClearAllFormatting';
import { useFormatCells } from '../useFormatCells';
import { useGetSelection } from '../useGetSelection';
import { useGetBorderMenu } from './useGetBorderMenu';

interface IProps {
  sheet_controller: SheetController;
}

export const FormatMenu = (props: IProps) => {
  const { format } = useGetSelection(props.sheet_controller.sheet);
  const {
    changeFillColor,
    removeFillColor,
    changeBold,
    changeItalic,
    changeTextColor,
    removeTextColor,
    changeAlignment,
  } = useFormatCells(props.sheet_controller);

  // focus canvas after the format menu closes
  const onMenuChange = useCallback((event: MenuChangeEvent) => {
    if (!event.open) focusGrid();
  }, []);

  const borders = useGetBorderMenu({ sheetController: props.sheet_controller });

  const { clearAllFormatting } = useClearAllFormatting(props.sheet_controller);

  return (
    <Menu
      onMenuChange={onMenuChange}
      menuButton={
        <Tooltip title="Cell format" arrow disableInteractive enterDelay={500} enterNextDelay={500}>
          <Button style={{ color: 'inherit' }}>
            <PaletteOutlined fontSize="small"></PaletteOutlined>
            <KeyboardArrowDown fontSize="small"></KeyboardArrowDown>
          </Button>
        </Tooltip>
      }
    >
      <MenuItem onClick={() => changeBold(!(format.bold === true))}>
        <MenuLineItem primary="Bold" secondary={KeyboardSymbols.Command + 'B'} Icon={FormatBold} />
      </MenuItem>
      <MenuItem onClick={() => changeItalic(!(format.italic === true))}>
        <MenuLineItem primary="Italic" secondary={KeyboardSymbols.Command + 'I'} Icon={FormatItalic} />
      </MenuItem>
      <SubMenu
        className="color-picker-submenu"
        id="TextColorMenuID"
        label={<MenuLineItem primary="Text color" Icon={FormatColorText} />}
      >
        <QColorPicker onChangeComplete={changeTextColor} onClear={removeTextColor} />
      </SubMenu>

      <MenuDivider />
      <MenuItem onClick={() => changeAlignment('left')}>
        <MenuLineItem primary="Left" Icon={FormatAlignLeft} secondary="" />
      </MenuItem>
      <MenuItem onClick={() => changeAlignment('center')}>
        <MenuLineItem primary="Center" Icon={FormatAlignCenter} />
      </MenuItem>
      <MenuItem onClick={() => changeAlignment('right')}>
        <MenuLineItem primary="Right" Icon={FormatAlignRight} />
      </MenuItem>

      <MenuDivider />
      <SubMenu
        className="color-picker-submenu"
        id="FillColorMenuID"
        label={<MenuLineItem primary="Fill color" Icon={FormatColorFill} />}
      >
        <QColorPicker onChangeComplete={changeFillColor} onClear={removeFillColor} />
      </SubMenu>

      <SubMenu label={<MenuLineItem primary="Border" Icon={BorderAll} />}>{borders}</SubMenu>

      <MenuDivider />
      <MenuItem
        onClick={() => {
          clearAllFormatting();
        }}
      >
        <MenuLineItem primary="Clear formatting" secondary={KeyboardSymbols.Command + '\\'} Icon={FormatClear} />
      </MenuItem>
    </Menu>
  );
};
