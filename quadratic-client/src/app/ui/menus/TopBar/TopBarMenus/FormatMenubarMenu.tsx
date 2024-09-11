import { Action } from '@/app/actions/actions';
import { MenubarBorderItemAction } from '@/app/ui/menus/TopBar/TopBarMenus/MenubarBorderItemAction';
import { MenubarColorPickerItemAction } from '@/app/ui/menus/TopBar/TopBarMenus/MenubarColorPickerItemAction';
import { FormatAlignLeftIcon, FormatBoldIcon, FormatTextWrapIcon, Number123Icon } from '@/shared/components/Icons';
import {
  MenubarContent,
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
            <MenubarItemAction action={Action.FormatNumberAutomatic} actionArgs={undefined} />
            <MenubarItemAction
              action={Action.FormatNumberCurrency}
              actionArgs={undefined}
              shortcutOverride="$1,000.12"
            />
            <MenubarItemAction action={Action.FormatNumberPercent} actionArgs={undefined} shortcutOverride="10.12%" />
            <MenubarItemAction
              action={Action.FormatNumberScientific}
              actionArgs={undefined}
              shortcutOverride="1.01E+03"
            />

            <MenubarSeparator />

            <MenubarItemAction
              action={Action.FormatNumberToggleCommas}
              actionArgs={undefined}
              shortcutOverride="1,000.12"
            />
            <MenubarItemAction
              action={Action.FormatNumberDecimalIncrease}
              actionArgs={undefined}
              shortcutOverride=".0000"
            />
            <MenubarItemAction
              action={Action.FormatNumberDecimalDecrease}
              actionArgs={undefined}
              shortcutOverride=".0"
            />
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSub>
          <MenubarSubTrigger>
            <FormatBoldIcon />
            Text
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarItemAction action={Action.ToggleBold} actionArgs={undefined} />
            <MenubarItemAction action={Action.ToggleItalic} actionArgs={undefined} />
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSub>
          <MenubarSubTrigger>
            <FormatAlignLeftIcon />
            Alignment
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarItemAction action={Action.FormatAlignHorizontalLeft} actionArgs={undefined} />
            <MenubarItemAction action={Action.FormatAlignHorizontalCenter} actionArgs={undefined} />
            <MenubarItemAction action={Action.FormatAlignHorizontalRight} actionArgs={undefined} />

            <MenubarSeparator />

            <MenubarItemAction action={Action.FormatAlignVerticalTop} actionArgs={undefined} />
            <MenubarItemAction action={Action.FormatAlignVerticalMiddle} actionArgs={undefined} />
            <MenubarItemAction action={Action.FormatAlignVerticalBottom} actionArgs={undefined} />
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSub>
          <MenubarSubTrigger>
            <FormatTextWrapIcon /> Wrapping
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarItemAction action={Action.FormatTextWrapWrap} actionArgs={undefined} />
            <MenubarItemAction action={Action.FormatTextWrapOverflow} actionArgs={undefined} />
            <MenubarItemAction action={Action.FormatTextWrapClip} actionArgs={undefined} />
          </MenubarSubContent>
        </MenubarSub>

        <MenubarSeparator />

        <MenubarColorPickerItemAction action={Action.FormatTextColor} />
        <MenubarColorPickerItemAction action={Action.FormatFillColor} />
        <MenubarBorderItemAction action={Action.FormatBorders} />

        <MenubarSeparator />

        <MenubarItemAction action={Action.ClearFormattingBorders} actionArgs={undefined} />
      </MenubarContent>
    </MenubarMenu>
  );
};
