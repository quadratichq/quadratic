import { Action } from '@/app/actions/actions';
import { useBorders } from '@/app/ui/hooks/useBorders';
import { MenubarColorPickerItemAction } from '@/app/ui/menus/TopBar/TopBarMenus/MenubarColorPickerItemAction';
import {
  BorderAllIcon,
  FormatAlignLeftIcon,
  FormatBoldIcon,
  FormatTextWrapIcon,
  Number123Icon,
} from '@/shared/components/Icons';
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
  const borders = useBorders();
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
        <MenubarSub>
          <MenubarSubTrigger>
            <BorderAllIcon /> Borders
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarItemAction action={Action.FormatBorderAll} actionArgs={borders} />
            <MenubarItemAction action={Action.FormatBorderOuter} actionArgs={borders} />
            <MenubarItemAction action={Action.FormatBorderInner} actionArgs={borders} />
            <MenubarItemAction action={Action.FormatBorderVertical} actionArgs={borders} />
            <MenubarItemAction action={Action.FormatBorderHorizontal} actionArgs={borders} />
            <MenubarItemAction action={Action.FormatBorderLeft} actionArgs={borders} />
            <MenubarItemAction action={Action.FormatBorderRight} actionArgs={borders} />
            <MenubarItemAction action={Action.FormatBorderTop} actionArgs={borders} />
            <MenubarItemAction action={Action.FormatBorderBottom} actionArgs={borders} />
            <MenubarItemAction action={Action.FormatBorderClear} actionArgs={borders} />
          </MenubarSubContent>
        </MenubarSub>

        <MenubarSeparator />

        <MenubarItemAction action={Action.ClearFormattingBorders} actionArgs={undefined} />
      </MenubarContent>
    </MenubarMenu>
  );
};
