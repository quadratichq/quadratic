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
import { MenubarItemAction } from './MenubarItemAction';

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
            <MenubarItemAction action={Action.FormatNumberAutomatic} />
            <MenubarItemAction action={Action.FormatNumberCurrency} shortcutOverride="$1,000.12" />
            <MenubarItemAction action={Action.FormatNumberPercent} shortcutOverride="10.12%" />
            <MenubarItemAction action={Action.FormatNumberScientific} shortcutOverride="1.01E+03" />

            <MenubarSeparator />

            <MenubarItemAction action={Action.FormatNumberToggleCommas} shortcutOverride="1,000.12" />
            <MenubarItemAction action={Action.FormatNumberDecimalIncrease} shortcutOverride=".0000" />
            <MenubarItemAction action={Action.FormatNumberDecimalDecrease} shortcutOverride=".0" />
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSub>
          <MenubarSubTrigger>
            <FormatBoldIcon />
            Text
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarItemAction action={Action.ToggleBold} />
            <MenubarItemAction action={Action.ToggleItalic} />
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSub>
          <MenubarSubTrigger>
            <FormatAlignLeftIcon />
            Alignment
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarItemAction action={Action.FormatAlignHorizontalLeft} />
            <MenubarItemAction action={Action.FormatAlignHorizontalCenter} />
            <MenubarItemAction action={Action.FormatAlignHorizontalRight} />

            <MenubarSeparator />

            <MenubarItemAction action={Action.FormatAlignVerticalTop} />
            <MenubarItemAction action={Action.FormatAlignVerticalMiddle} />
            <MenubarItemAction action={Action.FormatAlignVerticalBottom} />
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSub>
          <MenubarSubTrigger>
            <FormatTextWrapIcon /> Wrapping
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarItemAction action={Action.FormatTextWrapWrap} />
            <MenubarItemAction action={Action.FormatTextWrapOverflow} />
            <MenubarItemAction action={Action.FormatTextWrapClip} />
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

        <MenubarItemAction action={Action.ClearFormattingBorders} />
      </MenubarContent>
    </MenubarMenu>
  );
};
