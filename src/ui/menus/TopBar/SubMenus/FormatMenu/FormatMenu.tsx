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
  BorderClear,
} from '@mui/icons-material';
import { PaletteOutlined } from '@mui/icons-material';
import '@szhsin/react-menu/dist/index.css';
import { Tooltip } from '@mui/material';
import { colors } from '../../../../../theme/colors';
import { useRecoilState } from 'recoil';
import { gridInteractionStateAtom } from '../../../../../atoms/gridInteractionStateAtom';
import { menuItemIconStyles, topBarIconStyles } from '../menuStyles';
import { CompactPicker } from 'react-color';
import { useFormatCells } from '../useFormatCells';
import './formatMenuStyles.css';
import { PixiApp } from '../../../../../core/gridGL/pixiApp/PixiApp';

interface IProps {
  app?: PixiApp;
}

export const FormatMenu = (props: IProps) => {
  const [interactionState] = useRecoilState(gridInteractionStateAtom);
  const multiCursor = interactionState.showMultiCursor;

  const { changeFillColor, removeFillColor, changeBorder, changeBorderColor, clearFormatting } = useFormatCells({ app: props.app });

  // focus canvas after the format menu closes
  const onMenuChange = useCallback((event: MenuChangeEvent) => {
    if (!event.open) props.app?.focus();
  }, [props.app]);

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
        <CompactPicker onChangeComplete={changeFillColor} />
        <MenuItem onClick={removeFillColor}>
          Clear Fill Color
        </MenuItem>
      </SubMenu>

      <SubMenu
        label={
          <Fragment>
            <BorderAll style={menuItemIconStyles}></BorderAll>
            <span>Border</span>
          </Fragment>
        }
      >
      <SubMenu
        id="FillBorderColorMenuID"
        menuStyles={{
          padding: '0px',
        }}
        label={
          <>
            <BorderColor style={menuItemIconStyles}></BorderColor> Color
          </>
        }
      >
        <MenuHeader>Border Color</MenuHeader>
        <CompactPicker onChangeComplete={changeBorderColor} />
      </SubMenu>
        <MenuItem disabled={true}>
          <LineStyle style={menuItemIconStyles}></LineStyle>
          Line Style
        </MenuItem>
        {multiCursor && (
          <MenuItem onClick={() => changeBorder({
            borderLeft: true,
            borderRight: true,
            borderTop: true,
            borderBottom: true,
            borderVertical: true,
            borderHorizontal: true,
          })}>
            <BorderAll style={menuItemIconStyles}></BorderAll> All
          </MenuItem>
        )}
        <MenuItem onClick={() => changeBorder({
            borderLeft: true,
            borderRight: true,
            borderTop: true,
            borderBottom: true,
        })}>
          <BorderOuter style={menuItemIconStyles}></BorderOuter> Outer
        </MenuItem>
        <MenuItem onClick={() => changeBorder({ borderTop: true })}>
          <BorderTop style={menuItemIconStyles}></BorderTop> Top
        </MenuItem>
        <MenuItem onClick={() => changeBorder({ borderLeft: true })}>
          <BorderLeft style={menuItemIconStyles}></BorderLeft> Left
        </MenuItem>
        <MenuItem onClick={() => changeBorder({ borderRight: true })}>
          <BorderRight style={menuItemIconStyles}></BorderRight> Right
        </MenuItem>
        <MenuItem onClick={() => changeBorder({ borderBottom: true })}>
          <BorderBottom style={menuItemIconStyles}></BorderBottom> Bottom
        </MenuItem>
        {multiCursor && (
          <MenuItem onClick={() => changeBorder({ borderHorizontal: true, borderVertical: true })}>
            <BorderInner style={menuItemIconStyles}></BorderInner> Inner
          </MenuItem>
        )}
        {multiCursor && (
          <MenuItem onClick={() => changeBorder({ borderHorizontal: true })}>
            <BorderHorizontal style={menuItemIconStyles}></BorderHorizontal> Horizontal
          </MenuItem>
        )}
        {multiCursor && (
          <MenuItem onClick={() => changeBorder({ borderVertical: true })}>
            <BorderVertical style={menuItemIconStyles}></BorderVertical> Vertical
          </MenuItem>
        )}
        <MenuItem onClick={() => changeBorder({ borderTop: false, borderBottom: false, borderLeft: false, borderRight: false, borderHorizontal: false, borderVertical: false })}>
          <BorderClear style={menuItemIconStyles}></BorderClear> Clear Borders
        </MenuItem>
      </SubMenu>
      <MenuItem onClick={clearFormatting}>Clear Formatting</MenuItem>
    </Menu>
  );
};
