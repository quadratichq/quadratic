import {
  BorderNoneIcon,
  FontBoldIcon,
  FontItalicIcon,
  PaintBucketIcon,
  PaletteOutlined,
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
  clearFormattingAndBorders,
  setBold,
  setFillColor,
  setHorizontalAlign,
  setItalic,
  setTextColor,
  setVerticalAlign,
  setWrap,
} from '../formatCells';
import './formatMenuStyles.scss';
import { useGetBorderMenu } from './useGetBorderMenu';

export const FormatMenu = () => {
  // todo!!!
  const formatPrimaryCell = { bold: false, italic: false };

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
          <PaletteOutlined fontSize="small" />
        </TopBarMenuItem>
      )}
    >
      <MenuItem onClick={() => setBold(!(formatPrimaryCell?.bold === true))}>
        <MenuLineItem primary="Bold" secondary={KeyboardSymbols.Command + 'B'} Icon={FontBoldIcon} />
      </MenuItem>
      <MenuItem onClick={() => setItalic(!(formatPrimaryCell?.italic === true))}>
        <MenuLineItem primary="Italic" secondary={KeyboardSymbols.Command + 'I'} Icon={FontItalicIcon} />
      </MenuItem>
      <SubMenu
        className="color-picker-submenu"
        id="TextColorMenuID"
        label={<MenuLineItem primary="Text color" Icon={TextColorIcon} />}
      >
        <QColorPicker onChangeComplete={setTextColor} onClear={() => setTextColor()} />
      </SubMenu>

      <MenuDivider />
      <MenuItem onClick={() => setHorizontalAlign('left')}>
        <MenuLineItem primary="Left" Icon={TextAlignLeftIcon} secondary="" />
      </MenuItem>
      <MenuItem onClick={() => setHorizontalAlign('center')}>
        <MenuLineItem primary="Center" Icon={TextAlignRightIcon} />
      </MenuItem>
      <MenuItem onClick={() => setHorizontalAlign('right')}>
        <MenuLineItem primary="Right" Icon={TextAlignCenterIcon} />
      </MenuItem>

      <MenuDivider />
      <MenuItem onClick={() => setVerticalAlign('top')}>
        <MenuLineItem primary="Top" Icon={TextVerticalAlignTopIcon} secondary="" />
      </MenuItem>
      <MenuItem onClick={() => setVerticalAlign('middle')}>
        <MenuLineItem primary="Middle" Icon={TextVerticalAlignMiddleIcon} />
      </MenuItem>
      <MenuItem onClick={() => setVerticalAlign('bottom')}>
        <MenuLineItem primary="Bottom" Icon={TextVerticalAlignBottomIcon} />
      </MenuItem>

      <MenuDivider />
      <MenuItem onClick={() => setWrap(undefined)}>
        <MenuLineItem primary="Overflow" Icon={TextOverflowIcon} secondary="" />
      </MenuItem>
      <MenuItem onClick={() => setWrap('wrap')}>
        <MenuLineItem primary="Wrap" Icon={WrapTextIcon} />
      </MenuItem>
      <MenuItem onClick={() => setWrap('clip')}>
        <MenuLineItem primary="Clip" Icon={TextClipIcon} />
      </MenuItem>

      <MenuDivider />
      <SubMenu
        className="color-picker-submenu"
        id="FillColorMenuID"
        label={<MenuLineItem primary="Fill color" Icon={PaintBucketIcon} />}
      >
        <QColorPicker onChangeComplete={setFillColor} onClear={() => setFillColor()} />
      </SubMenu>

      <SubMenu label={<MenuLineItem primary="Border" Icon={BorderNoneIcon} />}>{borders}</SubMenu>

      <MenuDivider />
      <MenuItem onClick={clearFormattingAndBorders}>
        <MenuLineItem primary="Clear formatting" secondary={KeyboardSymbols.Command + '\\'} Icon={TextNoneIcon} />
      </MenuItem>
    </Menu>
  );
};
