import { Menu, MenuChangeEvent, MenuDivider, MenuItem, SubMenu } from '@szhsin/react-menu';
import { useCallback } from 'react';

import {
  // ReadMore,
  BorderAll,
  FormatAlignCenter,
  FormatAlignLeft,
  FormatAlignRight,
  FormatBold,
  FormatClear,
  FormatColorFill,
  // FormatAlignLeft,
  // FormatAlignRight,
  // FormatAlignCenter,
  FormatColorText,
  FormatItalic,
  PaletteOutlined,
} from '@mui/icons-material';
import '@szhsin/react-menu/dist/index.css';
import { QColorPicker } from '../../../../components/qColorPicker';
import { useFormatCells } from '../useFormatCells';
import './formatMenuStyles.scss';
import { useGetBorderMenu } from './useGetBorderMenu';

import { SheetController } from '../../../../../grid/controller/sheetController';
import { PixiApp } from '../../../../../gridGL/pixiApp/PixiApp';
import { KeyboardSymbols } from '../../../../../helpers/keyboardSymbols';
import { MenuLineItem } from '../../MenuLineItem';
import { TopBarMenuItem } from '../../TopBarMenuItem';
import { useClearAllFormatting } from '../useClearAllFormatting';
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
        <div>
          <TopBarMenuItem title="Cell format">
            <PaletteOutlined fontSize="small"></PaletteOutlined>
          </TopBarMenuItem>
        </div>
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
