import { Fragment, useCallback } from 'react';
import Button from '@mui/material/Button';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { Menu, MenuItem, MenuDivider, SubMenu, MenuChangeEvent } from '@szhsin/react-menu';

import {
  FormatBold,
  FormatItalic,
  FormatAlignLeft,
  FormatAlignRight,
  FormatAlignCenter,
  FormatColorText,
  FormatColorFill,
  FormatClear,
  ReadMore,
  BorderAll,
} from '@mui/icons-material';
import { PaletteOutlined } from '@mui/icons-material';
import '@szhsin/react-menu/dist/index.css';
import { Tooltip } from '@mui/material';
import { colors } from '../../../../../theme/colors';
import { menuItemIconStyles, menuItemIconDisabledStyles, topBarIconStyles } from '../menuStyles';
import { QColorPicker } from '../../../../components/qColorPicker';
import { useFormatCells } from '../useFormatCells';
import { useGetBorderMenu } from './useGetBorderMenu';
import { useBorders } from '../useBorders';
import './formatMenuStyles.scss';

import { PixiApp } from '../../../../../core/gridGL/pixiApp/PixiApp';
import { SheetController } from '../../../../../core/transaction/sheetController';
import { useGetSelection } from '../useGetSelection';

interface IProps {
  app: PixiApp;
  sheet_controller: SheetController;
}

export const FormatMenu = (props: IProps) => {
  const { format } = useGetSelection(props.sheet_controller.sheet);
  const {
    changeFillColor,
    removeFillColor,
    clearFormatting,
    changeBold,
    changeItalic,
    changeTextColor,
    removeTextColor
  } = useFormatCells(props.sheet_controller, props.app);
  const { clearBorders } = useBorders(props.sheet_controller.sheet, props.app);

  // focus canvas after the format menu closes
  const onMenuChange = useCallback(
    (event: MenuChangeEvent) => {
      if (!event.open) props.app?.focus();
    },
    [props.app]
  );

  const borders = useGetBorderMenu({ sheet: props.sheet_controller.sheet, app: props.app });

  const handleClearFormatting = useCallback(() => {
    clearFormatting();
    clearBorders();
  }, [clearFormatting, clearBorders]);

  return (
    <Menu
      onMenuChange={onMenuChange}
      menuButton={
        <Tooltip title="Format" arrow>
          <Button style={{ color: colors.darkGray }}>
            <PaletteOutlined style={topBarIconStyles}></PaletteOutlined>
            <KeyboardArrowDown fontSize="small"></KeyboardArrowDown>
          </Button>
        </Tooltip>
      }
    >
      <MenuItem type="checkbox" checked={format.bold === true} onClick={() => changeBold(!(format.bold === true))}>
        <FormatBold style={menuItemIconDisabledStyles}></FormatBold> Bold
      </MenuItem>
      <MenuItem type="checkbox" checked={format.italic === true} onClick={() => changeItalic(!(format.italic === true))}>
        <FormatItalic style={menuItemIconDisabledStyles}></FormatItalic> Italic
      </MenuItem>
      <SubMenu
        className="menuItemIndent"
        id="TextColorMenuID"
        menuStyles={{
          padding: '0px',
        }}
        label={
          <>
            <FormatColorText style={menuItemIconDisabledStyles}></FormatColorText> Text color
          </>
        }
      >
        <QColorPicker onChangeComplete={changeTextColor} />
        <MenuItem onClick={removeTextColor}>Clear</MenuItem>
      </SubMenu>

      {/* <MenuItem className="menuItemIndent">
        <FormatColorText style={menuItemIconDisabledStyles}></FormatColorText> Text color
      </MenuItem> */}

      <MenuDivider />
      <SubMenu
        className="menuItemIndent"
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

      <MenuDivider />
      <MenuItem type="checkbox">
        <FormatAlignLeft style={menuItemIconDisabledStyles}></FormatAlignLeft> Left
      </MenuItem>
      <MenuItem type="checkbox">
        <FormatAlignCenter style={menuItemIconDisabledStyles}></FormatAlignCenter> Center
      </MenuItem>
      <MenuItem type="checkbox">
        <FormatAlignRight style={menuItemIconDisabledStyles}></FormatAlignRight> Right
      </MenuItem>

      <MenuDivider />
      <SubMenu
        className="menuItemIndent"
        id="FillColorMenuID"
        menuStyles={{
          padding: '0px',
        }}
        label={
          <>
            <FormatColorFill style={menuItemIconStyles}></FormatColorFill> Fill color
          </>
        }
      >
        <QColorPicker onChangeComplete={changeFillColor} />
        <MenuItem onClick={removeFillColor}>Clear</MenuItem>
      </SubMenu>

      <SubMenu
        className="menuItemIndent"
        label={
          <Fragment>
            <BorderAll style={menuItemIconStyles}></BorderAll>
            <span>Border</span>
          </Fragment>
        }
      >
        {borders}
      </SubMenu>

      <MenuDivider />
      <MenuItem onClick={handleClearFormatting} className="menuItemIndent">
        <FormatClear style={menuItemIconStyles}></FormatClear>
        Clear formatting
      </MenuItem>
    </Menu>
  );
};
