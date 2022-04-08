import { Fragment } from 'react';
import Button from '@mui/material/Button';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import {
  Menu,
  MenuItem,
  MenuDivider,
  MenuHeader,
  SubMenu,
} from '@szhsin/react-menu';

import {
  FormatBold,
  FormatItalic,
  FormatAlignLeft,
  FormatAlignRight,
  FormatAlignCenter,
  FormatColorText,
  FormatColorFill,
  BorderColor,
  LineStyle,
  BorderAll,
  BorderOuter,
  BorderTop,
  BorderRight,
  BorderLeft,
  BorderBottom,
  BorderInner,
  BorderHorizontal,
  BorderVertical,
} from '@mui/icons-material';
import { PaletteOutlined } from '@mui/icons-material';
import '@szhsin/react-menu/dist/index.css';
import { Tooltip } from '@mui/material';

import { menuItemIconStyles, topBarIconStyles } from './menuStyles';

import { colors } from '../../../../theme/colors';

export const FormatMenu = () => {
  return (
    <Menu
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
      <MenuItem>
        <FormatBold style={menuItemIconStyles}></FormatBold> Bold
      </MenuItem>
      <MenuItem>
        <FormatItalic style={menuItemIconStyles}></FormatItalic> Italic
      </MenuItem>
      <MenuItem>
        <FormatColorText style={menuItemIconStyles}></FormatColorText> Color
      </MenuItem>

      <MenuDivider />
      <MenuItem>
        <FormatAlignLeft style={menuItemIconStyles}></FormatAlignLeft> Left
      </MenuItem>
      <MenuItem>
        <FormatAlignCenter style={menuItemIconStyles}></FormatAlignCenter>{' '}
        Center
      </MenuItem>
      <MenuItem>
        <FormatAlignRight style={menuItemIconStyles}></FormatAlignRight> Right
      </MenuItem>

      <MenuDivider />
      <MenuHeader>Cell</MenuHeader>
      <MenuItem>
        <FormatColorFill style={menuItemIconStyles}></FormatColorFill> Fill
        Color
      </MenuItem>

      <SubMenu
        label={
          <Fragment>
            <BorderAll style={menuItemIconStyles}></BorderAll>
            <span>Border</span>
          </Fragment>
        }
      >
        <MenuItem>
          <BorderColor style={menuItemIconStyles}></BorderColor> Color
        </MenuItem>
        <MenuItem>
          <LineStyle style={menuItemIconStyles}></LineStyle>
          Line Style
        </MenuItem>
        <MenuItem>
          <BorderAll style={menuItemIconStyles}></BorderAll> All
        </MenuItem>
        <MenuItem>
          <BorderOuter style={menuItemIconStyles}></BorderOuter> Outer
        </MenuItem>
        <MenuItem>
          <BorderTop style={menuItemIconStyles}></BorderTop> Top
        </MenuItem>
        <MenuItem>
          <BorderLeft style={menuItemIconStyles}></BorderLeft> Left
        </MenuItem>
        <MenuItem>
          <BorderRight style={menuItemIconStyles}></BorderRight> Right
        </MenuItem>
        <MenuItem>
          <BorderBottom style={menuItemIconStyles}></BorderBottom> Bottom
        </MenuItem>
        <MenuItem>
          <BorderInner style={menuItemIconStyles}></BorderInner> Inner
        </MenuItem>
        <MenuItem>
          <BorderHorizontal style={menuItemIconStyles}></BorderHorizontal>{' '}
          Horizontal
        </MenuItem>
        <MenuItem>
          <BorderVertical style={menuItemIconStyles}></BorderVertical> Vertical
        </MenuItem>
      </SubMenu>
    </Menu>
  );
};
