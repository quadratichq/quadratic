import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { focusGrid } from '@/app/helpers/focusGrid';
import { QColorPicker } from '@/app/ui/components/qColorPicker';
import { useBorders, UseBordersResults } from '@/app/ui/hooks/useBorders';
import {
  BorderAllIcon,
  FormatAlignLeftIcon,
  FormatBoldIcon,
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
            <MenubarSub>
              <MenubarSubTrigger>
                <BorderAllIcon /> Border line style
              </MenubarSubTrigger>
              <MenubarSubContent>
                <MenubarItemAction action={Action.FormatBorderLine1} actionArgs={borders} />
                <MenubarItemAction action={Action.FormatBorderLine2} actionArgs={borders} />
                <MenubarItemAction action={Action.FormatBorderLine3} actionArgs={borders} />
                <MenubarItemAction action={Action.FormatBorderDashed} actionArgs={borders} />
                <MenubarItemAction action={Action.FormatBorderDotted} actionArgs={borders} />
                <MenubarItemAction action={Action.FormatBorderDouble} actionArgs={borders} />
              </MenubarSubContent>
            </MenubarSub>
            <MenubarBorderColorPickerItemAction action={Action.FormatBorderColor} borders={borders} />
          </MenubarSubContent>
        </MenubarSub>

        <MenubarSeparator />

        <MenubarItemAction action={Action.ClearFormattingBorders} actionArgs={undefined} />
      </MenubarContent>
    </MenubarMenu>
  );
};

function MenubarColorPickerItemAction({ action }: { action: Action.FormatTextColor | Action.FormatFillColor }) {
  const actionSpec = defaultActionSpec[action];
  const { run, label } = actionSpec;
  const Icon = 'Icon' in actionSpec ? actionSpec.Icon : undefined;

  // TODO: (jimniels) implement isAvailable
  return (
    <MenubarSub>
      <MenubarSubTrigger>
        {Icon && <Icon />}
        {label}
      </MenubarSubTrigger>
      <MenubarSubContent>
        <MenubarItem>
          <QColorPicker
            onChangeComplete={(color) => {
              run(color);
              focusGrid();
            }}
            onClear={() => {
              run(undefined);
              focusGrid();
            }}
          />
        </MenubarItem>
      </MenubarSubContent>
    </MenubarSub>
  );
}

function MenubarBorderColorPickerItemAction({
  action,
  borders,
}: {
  action: Action.FormatBorderColor;
  borders: UseBordersResults;
}) {
  const actionSpec = defaultActionSpec[action];
  const { run, label } = actionSpec;
  const Icon = 'Icon' in actionSpec ? actionSpec.Icon : undefined;

  // TODO: (jimniels) implement isAvailable
  return (
    <MenubarSub>
      <MenubarSubTrigger>
        {Icon && <Icon />}
        {label}
      </MenubarSubTrigger>
      <MenubarSubContent>
        <MenubarItem>
          <QColorPicker
            onChangeComplete={(color) => {
              run({ borders, color });
              focusGrid();
            }}
          />
        </MenubarItem>
      </MenubarSubContent>
    </MenubarSub>
  );
}