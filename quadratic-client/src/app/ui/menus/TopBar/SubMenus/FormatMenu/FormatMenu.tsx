import {
  BorderNoneIcon,
  FontBoldIcon,
  FontItalicIcon,
  PaintBucketIcon,
  PaletteOutlinedIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  TextClipIcon,
  TextColorIcon,
  TextNoneIcon,
  TextOverflowIcon,
  TextVerticalAlignBottomIcon,
  TextVerticalAlignMiddleIcon,
  TextVerticalAlignTopIcon,
  WrapTextIcon,
} from '@/app/ui/icons';
import { Menu, MenuChangeEvent, MenuDivider, MenuItem, SubMenu } from '@szhsin/react-menu';
import { useCallback } from 'react';
import { focusGrid } from '../../../../../helpers/focusGrid';
import { KeyboardSymbols } from '../../../../../helpers/keyboardSymbols';
import { QColorPicker } from '../../../../components/qColorPicker';
import { MenuLineItem } from '../../MenuLineItem';
import { TopBarMenuItem } from '../../TopBarMenuItem';
import {
  clearFillColor,
  clearFormattingAndBorders,
  setAlign,
  setBold,
  setFillColor,
  setItalic,
  setTextColor,
  setVerticalAlign,
  setWrap,
} from '../formatCells';
import './formatMenuStyles.scss';
import { useGetBorderMenu } from './useGetBorderMenu';

export const FormatMenu = () => {
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
          <PaletteOutlinedIcon fontSize="small" />
        </TopBarMenuItem>
      )}
    >
      <MenuItem onClick={() => setBold()}>
        <MenuLineItem primary="Bold" secondary={KeyboardSymbols.Command + 'B'} icon={FontBoldIcon} />
      </MenuItem>
      <MenuItem onClick={() => setItalic()}>
        <MenuLineItem primary="Italic" secondary={KeyboardSymbols.Command + 'I'} icon={FontItalicIcon} />
      </MenuItem>
      <SubMenu
        className="color-picker-submenu"
        id="TextColorMenuID"
        label={<MenuLineItem primary="Text color" icon={TextColorIcon} />}
      >
        <QColorPicker onChangeComplete={setTextColor} onClear={() => setTextColor()} />
      </SubMenu>

      <MenuDivider />
      <MenuItem onClick={() => setAlign('left')}>
        <MenuLineItem primary="Left" icon={TextAlignLeftIcon} secondary="" />
      </MenuItem>
      <MenuItem onClick={() => setAlign('center')}>
        <MenuLineItem primary="Center" icon={TextAlignCenterIcon} />
      </MenuItem>
      <MenuItem onClick={() => setAlign('right')}>
        <MenuLineItem primary="Right" icon={TextAlignRightIcon} />
      </MenuItem>

      <MenuDivider />
      <MenuItem onClick={() => setVerticalAlign('top')}>
        <MenuLineItem primary="Top" icon={TextVerticalAlignTopIcon} secondary="" />
      </MenuItem>
      <MenuItem onClick={() => setVerticalAlign('middle')}>
        <MenuLineItem primary="Middle" icon={TextVerticalAlignMiddleIcon} />
      </MenuItem>
      <MenuItem onClick={() => setVerticalAlign('bottom')}>
        <MenuLineItem primary="Bottom" icon={TextVerticalAlignBottomIcon} />
      </MenuItem>

      <MenuDivider />
      <MenuItem onClick={() => setWrap('overflow')}>
        <MenuLineItem primary="Overflow" icon={TextOverflowIcon} secondary="" />
      </MenuItem>
      <MenuItem onClick={() => setWrap('wrap')}>
        <MenuLineItem primary="Wrap" icon={WrapTextIcon} />
      </MenuItem>
      <MenuItem onClick={() => setWrap('clip')}>
        <MenuLineItem primary="Clip" icon={TextClipIcon} />
      </MenuItem>

      <MenuDivider />
      <SubMenu
        className="color-picker-submenu"
        id="FillColorMenuID"
        label={<MenuLineItem primary="Fill color" icon={PaintBucketIcon} />}
      >
        <QColorPicker onChangeComplete={setFillColor} onClear={clearFillColor} />
      </SubMenu>

      <SubMenu label={<MenuLineItem primary="Border" icon={BorderNoneIcon} />}>{borders}</SubMenu>

      <MenuDivider />
      <MenuItem onClick={clearFormattingAndBorders}>
        <MenuLineItem primary="Clear formatting" secondary={KeyboardSymbols.Command + '\\'} icon={TextNoneIcon} />
      </MenuItem>
    </Menu>
  );
};
