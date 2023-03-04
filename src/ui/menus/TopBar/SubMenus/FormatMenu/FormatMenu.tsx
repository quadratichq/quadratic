import { useCallback } from 'react';
import Button from '@mui/material/Button';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { Menu, MenuItem, MenuDivider, SubMenu, MenuChangeEvent } from '@szhsin/react-menu';

import {
  FormatBold,
  FormatItalic,
  // FormatAlignLeft,
  // FormatAlignRight,
  // FormatAlignCenter,
  FormatColorText,
  FormatColorFill,
  FormatClear,
  // ReadMore,
  BorderAll,
  FormatAlignLeft,
  FormatAlignCenter,
  FormatAlignRight,
} from '@mui/icons-material';
import { PaletteOutlined } from '@mui/icons-material';
import '@szhsin/react-menu/dist/index.css';
import { Tooltip } from '@mui/material';
import { QColorPicker } from '../../../../components/qColorPicker';
import { useFormatCells } from '../useFormatCells';
import { useGetBorderMenu } from './useGetBorderMenu';
import './formatMenuStyles.scss';

import { PixiApp } from '../../../../../gridGL/pixiApp/PixiApp';
import { SheetController } from '../../../../../grid/controller/sheetController';
import { useGetSelection } from '../useGetSelection';
import { MenuLineItem } from '../../MenuLineItem';
import { KeyboardSymbols } from '../../../../../helpers/keyboardSymbols';
import { useClearAllFormatting } from '../useClearAllFormatting';

interface IProps {
  app: PixiApp;
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
  } = useFormatCells(props.sheet_controller, props.app);

  // focus canvas after the format menu closes
  const onMenuChange = useCallback(
    (event: MenuChangeEvent) => {
      if (!event.open) props.app?.focus();
    },
    [props.app]
  );

  const borders = useGetBorderMenu({ sheet: props.sheet_controller.sheet, app: props.app });

  const { clearAllFormatting } = useClearAllFormatting(props.sheet_controller, props.app);

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

      {/* <MenuItem >
        <FormatColorText></FormatColorText> Text color
      </MenuItem> */}

      {/*
      <MenuDivider />
      <SubMenu

        label={
          <Fragment>
            <ReadMore style={menuItemIconStyles}></ReadMore>
            <span>Wrapping</span>
          </Fragment>
        }
      >
        <MenuItem type="checkbox">Overflow</MenuItem>
        <MenuItem type="checkbox">Wrap</MenuItem>
        <MenuItem type="checkbox">Clip</MenuItem>
      </SubMenu>

      */}
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
