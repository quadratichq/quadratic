import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { editorInteractionStateTransactionsInfoAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { focusGrid } from '@/app/helpers/focusGrid';
import type { CellFormatSummary } from '@/app/quadratic-core-types';
import { BorderMenu } from '@/app/ui/components/BorderMenu';
import { ColorPicker } from '@/app/ui/components/ColorPicker';
import { DateFormat } from '@/app/ui/components/DateFormat';
import { MenubarItemAction } from '@/app/ui/menus/TopBar/TopBarMenus/MenubarItemAction';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
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
import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

export const FormatMenubarMenu = () => {
  // get the format summary for the current selection
  const [formatSummary, setFormatSummary] = useState<CellFormatSummary | undefined>(undefined);
  const transactionsInfo = useRecoilValue(editorInteractionStateTransactionsInfoAtom);
  useEffect(() => {
    const updateFormatSummary = async () => {
      // don't update the format summary if there are transactions in progress
      if (transactionsInfo.length > 0) return;
      try {
        const summary = await quadraticCore.getFormatSelection(sheets.sheet.cursor.save());
        if (summary && 'error' in summary) {
          console.error('[FormatMenubarMenu] Error getting format summary', summary.error);
        } else {
          setFormatSummary(summary);
        }
      } catch (e) {
        console.error('[FormatMenubarMenu] Error getting format summary', e);
      }
    };
    updateFormatSummary();

    events.on('cursorPosition', updateFormatSummary);
    return () => {
      events.off('cursorPosition', updateFormatSummary);
    };
  }, [transactionsInfo.length]);

  return (
    <MenubarMenu>
      <MenubarTrigger>Format</MenubarTrigger>
      <MenubarContent className="pointer-move-ignore">
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

        <DataTimeSubMenu action={Action.FormatDateTime} />

        <MenubarSub>
          <MenubarSubTrigger>
            <FormatBoldIcon />
            Text
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarItemAction action={Action.ToggleBold} actionArgs={undefined} />
            <MenubarItemAction action={Action.ToggleItalic} actionArgs={undefined} />
            <MenubarItemAction action={Action.ToggleUnderline} actionArgs={undefined} />
            <MenubarItemAction action={Action.ToggleStrikeThrough} actionArgs={undefined} />
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

        <MenubarColorPickerSubMenu
          action={Action.FormatTextColor}
          activeColor={formatSummary?.textColor ?? undefined}
        />

        <MenubarColorPickerSubMenu
          action={Action.FormatFillColor}
          activeColor={formatSummary?.fillColor ?? undefined}
        />

        <MenubarSub>
          <MenubarSubTrigger>
            <BorderAllIcon /> Borders
          </MenubarSubTrigger>
          <MenubarSubContent>
            <BorderMenu />
          </MenubarSubContent>
        </MenubarSub>

        <MenubarSeparator />

        <MenubarItemAction action={Action.MergeCells} actionArgs={undefined} />
        <MenubarItemAction action={Action.UnmergeCells} actionArgs={undefined} />

        <MenubarSeparator />

        <MenubarItemAction action={Action.ClearFormattingBorders} actionArgs={undefined} />

        <MenubarSeparator />

        <MenubarItemAction action={Action.ToggleConditionalFormat} actionArgs={undefined} />
      </MenubarContent>
    </MenubarMenu>
  );
};

function DataTimeSubMenu({ action }: { action: Action.FormatDateTime }) {
  const actionSpec = defaultActionSpec[action];
  const label = actionSpec.label();
  const Icon = 'Icon' in actionSpec ? actionSpec.Icon : undefined;

  return (
    <MenubarSub>
      <MenubarSubTrigger>
        {Icon && <Icon />}
        {label}
      </MenubarSubTrigger>
      <MenubarSubContent>
        <DateFormat className="block min-w-80 p-2" closeMenu={() => focusGrid()} />
      </MenubarSubContent>
    </MenubarSub>
  );
}

function MenubarColorPickerSubMenu({
  action,
  activeColor,
}: {
  action: Action.FormatTextColor | Action.FormatFillColor;
  activeColor?: string;
}) {
  const [open, setOpen] = useState(false);
  const actionSpec = defaultActionSpec[action];
  const label = actionSpec.label();
  const Icon = 'Icon' in actionSpec ? actionSpec.Icon : undefined;

  const iconNode = Icon ? (
    <div className="relative flex items-center justify-center">
      <Icon />
      <div
        className="absolute bottom-0 left-0.5 right-0.5 h-1 rounded-sm"
        style={{ backgroundColor: activeColor ?? 'currentColor' }}
      />
    </div>
  ) : null;

  return (
    <MenubarSub open={open} onOpenChange={setOpen}>
      <MenubarSubTrigger>
        {iconNode}
        {label}
      </MenubarSubTrigger>
      <MenubarSubContent>
        <MenubarItem
          className="color-picker-dropdown-menu flex-col gap-0 p-0 hover:bg-background focus:bg-background"
          onSelect={(e) => e.preventDefault()}
        >
          <ColorPicker
            color={activeColor}
            onChangeComplete={(color) => {
              actionSpec.run(color);
              focusGrid();
            }}
            onClear={() => {
              actionSpec.run(undefined);
              focusGrid();
            }}
            onClose={() => setOpen(false)}
          />
        </MenubarItem>
      </MenubarSubContent>
    </MenubarSub>
  );
}
