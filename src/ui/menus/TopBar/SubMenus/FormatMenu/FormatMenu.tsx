import { Fragment, useCallback } from 'react';
import Button from '@mui/material/Button';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { Menu, MenuItem, MenuDivider, MenuHeader, SubMenu, MenuChangeEvent } from '@szhsin/react-menu';

import {
  FormatBold,
  FormatItalic,
  FormatAlignLeft,
  FormatAlignRight,
  FormatAlignCenter,
  FormatColorText,
  FormatColorFill,
  ReadMore,
} from '@mui/icons-material';
import { PaletteOutlined } from '@mui/icons-material';
import '@szhsin/react-menu/dist/index.css';
import { Tooltip } from '@mui/material';
import { colors } from '../../../../../theme/colors';
import { menuItemIconStyles, topBarIconStyles } from '../menuStyles';
import { QColorPicker } from '../../../../components/qColorPicker';
import { useFormatCells } from '../useFormatCells';
import { PixiApp } from '../../../../../core/gridGL/pixiApp/PixiApp';
import { useGetBorderMenu } from './useGetBorderMenu';
import { useBorders } from '../useBorders';
import './formatMenuStyles.scss';

interface IProps {
  app?: PixiApp;
}

export const FormatMenu = (props: IProps) => {
  const { changeFillColor, removeFillColor, clearFormatting } = useFormatCells(props.app);
  const { clearBorders } = useBorders(props.app);

  // focus canvas after the format menu closes
  const onMenuChange = useCallback(
    (event: MenuChangeEvent) => {
      if (!event.open) props.app?.focus();
    },
    [props.app]
  );

  const borders = useGetBorderMenu({ app: props.app });

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
      <MenuHeader>Text</MenuHeader>
      <MenuItem disabled>
        <FormatBold style={menuItemIconStyles}></FormatBold> Bold
      </MenuItem>
      <MenuItem disabled>
        <FormatItalic style={menuItemIconStyles}></FormatItalic> Italic
      </MenuItem>
      <MenuItem disabled>
        <FormatColorText style={menuItemIconStyles}></FormatColorText> Color
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
        <FormatAlignLeft style={menuItemIconStyles}></FormatAlignLeft> Left
      </MenuItem>
      <MenuItem disabled>
        <FormatAlignCenter style={menuItemIconStyles}></FormatAlignCenter> Center
      </MenuItem>
      <MenuItem disabled>
        <FormatAlignRight style={menuItemIconStyles}></FormatAlignRight> Right
      </MenuItem>

      <MenuDivider />
      <MenuHeader>Cell</MenuHeader>
      <SubMenu
        id="FillColorMenuID"
        menuStyles={{
          padding: '0px',
        }}
        label={
          <>
            <FormatColorFill style={menuItemIconStyles}></FormatColorFill> Fill Color
          </>
        }
      >
        <MenuHeader>Fill Color</MenuHeader>
        <QColorPicker onChangeComplete={changeFillColor} />
        <MenuItem onClick={removeFillColor}>Clear Fill Color</MenuItem>
      </SubMenu>

      {borders}

      <MenuItem onClick={handleClearFormatting}>Clear Formatting</MenuItem>
    </Menu>
  );
};
