import {
  formatAlignHorizontalCenter,
  formatAlignHorizontalLeft,
  formatAlignHorizontalRight,
  formatAlignVerticalBottom,
  formatAlignVerticalMiddle,
  formatAlignVerticalTop,
  formatBold,
  formatClear,
  formatItalic,
  formatNumberAutomatic,
  formatNumberCurrency,
  formatNumberDecimalDecrease,
  formatNumberDecimalIncrease,
  formatNumberPercent,
  formatNumberScientific,
  formatNumberToggleCommas,
  formatTextWrappingClip,
  formatTextWrappingOverflow,
  formatTextWrappingWrap,
} from '@/app/actions/format';
import { QColorPicker } from '@/app/ui/components/qColorPicker';
import { setTextColor } from '@/app/ui/menus/TopBar/SubMenus/formatCells';
import {
  BorderAllIcon,
  FormatAlignLeftIcon,
  FormatBoldIcon,
  FormatColorFillIcon,
  FormatColorTextIcon,
  FormatTextWrapIcon,
  Number123Icon,
} from '@/shared/components/Icons';
import {
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from '@/shared/shadcn/ui/menubar';
import { MenuItemAction } from './MenubarItemAction';

export const FormatMenubarMenu = () => {
  return (
    <MenubarMenu>
      <MenubarTrigger>Format</MenubarTrigger>
      <MenubarContent>
        <MenubarSub>
          <MenubarSubTrigger>
            <Number123Icon /> Number
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenuItemAction action={formatNumberAutomatic} />
            <MenuItemAction action={{ ...formatNumberCurrency, keyboardShortcut: '$1,000.12' }} />
            <MenuItemAction action={{ ...formatNumberPercent, keyboardShortcut: '10.12%' }} />
            <MenuItemAction action={{ ...formatNumberScientific, keyboardShortcut: '1.01E+03' }} />
            <MenuItemAction action={{ ...formatNumberToggleCommas, keyboardShortcut: '1,000.12' }} />
            <MenuItemAction action={{ ...formatNumberDecimalIncrease, keyboardShortcut: '.0000' }} />
            <MenuItemAction action={{ ...formatNumberDecimalDecrease, keyboardShortcut: '.0' }} />
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSub>
          <MenubarSubTrigger>
            <FormatBoldIcon />
            Text
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenuItemAction action={formatBold} />
            <MenuItemAction action={formatItalic} />
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSub>
          <MenubarSubTrigger>
            <FormatAlignLeftIcon />
            Alignment
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenuItemAction action={formatAlignHorizontalLeft} />
            <MenuItemAction action={formatAlignHorizontalCenter} />
            <MenuItemAction action={formatAlignHorizontalRight} />
            <MenubarSeparator />
            <MenuItemAction action={formatAlignVerticalTop} />
            <MenuItemAction action={formatAlignVerticalMiddle} />
            <MenuItemAction action={formatAlignVerticalBottom} />
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSub>
          <MenubarSubTrigger>
            <FormatTextWrapIcon /> Wrapping
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenuItemAction action={formatTextWrappingWrap} />
            <MenuItemAction action={formatTextWrappingOverflow} />
            <MenuItemAction action={formatTextWrappingClip} />
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSeparator />
        <MenubarSub>
          <MenubarSubTrigger>
            <FormatColorTextIcon /> Text color
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarItem className="hover:bg-background">
              {/* TODO: (jimniels) style the color picker */}
              <QColorPicker
                onChangeComplete={(color) => {
                  setTextColor(color);
                  // focusGrid();
                }}
                onClear={() => {
                  setTextColor(undefined);
                  // focusGrid();
                }}
              />
            </MenubarItem>
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSub>
          <MenubarSubTrigger>
            <FormatColorFillIcon /> Fill color
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarItem>TODO</MenubarItem>
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSub>
          <MenubarSubTrigger>
            <BorderAllIcon /> Border
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarItem>TODO</MenubarItem>
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSeparator />
        <MenuItemAction action={formatClear} />
      </MenubarContent>
    </MenubarMenu>
  );
};
