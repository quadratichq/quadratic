import { Action } from '@/app/actions/actions';
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
            <MenuItemAction action={Action.FormatNumberAutomatic} />
            <MenuItemAction action={Action.FormatNumberCurrency} shortcutOverride="$1,000.12" />
            <MenuItemAction action={Action.FormatNumberPercent} shortcutOverride="10.12%" />
            <MenuItemAction action={Action.FormatNumberScientific} shortcutOverride="1.01E+03" />

            <MenubarSeparator />

            <MenuItemAction action={Action.FormatNumberToggleCommas} shortcutOverride="1,000.12" />
            <MenuItemAction action={Action.FormatNumberDecimalIncrease} shortcutOverride=".0000" />
            <MenuItemAction action={Action.FormatNumberDecimalDecrease} shortcutOverride=".0" />
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSub>
          <MenubarSubTrigger>
            <FormatBoldIcon />
            Text
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenuItemAction action={Action.ToggleBold} />
            <MenuItemAction action={Action.ToggleItalic} />
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSub>
          <MenubarSubTrigger>
            <FormatAlignLeftIcon />
            Alignment
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenuItemAction action={Action.FormatAlignHorizontalLeft} />
            <MenuItemAction action={Action.FormatAlignHorizontalCenter} />
            <MenuItemAction action={Action.FormatAlignHorizontalRight} />

            <MenubarSeparator />

            <MenuItemAction action={Action.FormatAlignVerticalTop} />
            <MenuItemAction action={Action.FormatAlignVerticalMiddle} />
            <MenuItemAction action={Action.FormatAlignVerticalBottom} />
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSub>
          <MenubarSubTrigger>
            <FormatTextWrapIcon /> Wrapping
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenuItemAction action={Action.FormatTextWrapWrap} />
            <MenuItemAction action={Action.FormatTextWrapOverflow} />
            <MenuItemAction action={Action.FormatTextWrapClip} />
          </MenubarSubContent>
        </MenubarSub>

        <MenubarSeparator />

        <MenubarSub>
          <MenubarSubTrigger>
            <FormatColorTextIcon /> Text color
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarItem className="hover:bg-background">
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
            <BorderAllIcon />
            Border
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarItem>TODO</MenubarItem>
          </MenubarSubContent>
        </MenubarSub>

        <MenubarSeparator />

        <MenuItemAction action={Action.ClearFormattingBorders} />
      </MenubarContent>
    </MenubarMenu>
  );
};
