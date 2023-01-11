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

interface IProps {
  app: PixiApp;
  sheet_controller: SheetController;
}

export const FormatMenu = (props: IProps) => {
  const { changeFillColor, removeFillColor, clearFormatting } = useFormatCells(props.sheet_controller, props.app);
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
      <MenuItem disabled>
        <FormatBold style={menuItemIconDisabledStyles}></FormatBold> Bold
      </MenuItem>
      <MenuItem disabled>
        <FormatItalic style={menuItemIconDisabledStyles}></FormatItalic> Italic
      </MenuItem>
      <MenuItem disabled>
        <FormatColorText style={menuItemIconDisabledStyles}></FormatColorText> Text color
      </MenuItem>

      <MenuDivider />
      <SubMenu
        label={
          <Fragment>
            <ReadMore style={menuItemIconStyles}></ReadMore>
            <span>Wrapping</span>
          </Fragment>
        }
      >
        <MenuItem disabled>Overflow</MenuItem>
        <MenuItem disabled>Wrap</MenuItem>
        <MenuItem disabled>Clip</MenuItem>
      </SubMenu>

      <MenuDivider />
      <MenuItem disabled>
        <FormatAlignLeft style={menuItemIconDisabledStyles}></FormatAlignLeft> Left
      </MenuItem>
      <MenuItem disabled>
        <FormatAlignCenter style={menuItemIconDisabledStyles}></FormatAlignCenter> Center
      </MenuItem>
      <MenuItem disabled>
        <FormatAlignRight style={menuItemIconDisabledStyles}></FormatAlignRight> Right
      </MenuItem>

      <MenuDivider />
      <SubMenu
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

      {borders}

      <MenuDivider />
      <MenuItem onClick={handleClearFormatting}>
        <FormatClear style={menuItemIconStyles}></FormatClear>
        Clear formatting
      </MenuItem>
    </Menu>
  );
};
