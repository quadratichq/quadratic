import { Fragment } from 'react';
import Button from '@mui/material/Button';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { Menu, MenuItem, MenuDivider, MenuHeader, SubMenu } from '@szhsin/react-menu';

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
  ReadMore,
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
      <MenuHeader>Coming soon</MenuHeader>
      <MenuDivider></MenuDivider>
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
      <MenuItem disabled>
        <FormatColorFill style={menuItemIconStyles}></FormatColorFill> Fill Color
      </MenuItem>

      <SubMenu
        label={
          <Fragment>
            <BorderAll style={menuItemIconStyles}></BorderAll>
            <span>Border</span>
          </Fragment>
        }
      >
        <MenuItem disabled>
          <BorderColor style={menuItemIconStyles}></BorderColor> Color
        </MenuItem>
        <MenuItem disabled>
          <LineStyle style={menuItemIconStyles}></LineStyle>
          Line Style
        </MenuItem>
        <MenuItem disabled>
          <BorderAll style={menuItemIconStyles}></BorderAll> All
        </MenuItem>
        <MenuItem disabled>
          <BorderOuter style={menuItemIconStyles}></BorderOuter> Outer
        </MenuItem>
        <MenuItem disabled>
          <BorderTop style={menuItemIconStyles}></BorderTop> Top
        </MenuItem>
        <MenuItem disabled>
          <BorderLeft style={menuItemIconStyles}></BorderLeft> Left
        </MenuItem>
        <MenuItem disabled>
          <BorderRight style={menuItemIconStyles}></BorderRight> Right
        </MenuItem>
        <MenuItem disabled>
          <BorderBottom style={menuItemIconStyles}></BorderBottom> Bottom
        </MenuItem>
        <MenuItem disabled>
          <BorderInner style={menuItemIconStyles}></BorderInner> Inner
        </MenuItem>
        <MenuItem disabled>
          <BorderHorizontal style={menuItemIconStyles}></BorderHorizontal> Horizontal
        </MenuItem>
        <MenuItem disabled>
          <BorderVertical style={menuItemIconStyles}></BorderVertical> Vertical
        </MenuItem>
      </SubMenu>
    </Menu>
  );
};
