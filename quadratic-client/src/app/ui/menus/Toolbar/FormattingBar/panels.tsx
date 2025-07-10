import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { focusGrid } from '@/app/helpers/focusGrid';
import type { CellFormatSummary } from '@/app/quadratic-core-types';
import { BorderMenu } from '@/app/ui/components/BorderMenu';
import {
  FormatButton,
  FormatButtonDropdown,
  FormatButtonDropdownActions,
  FormatButtonPopover,
  FormatColorPickerButton,
  FormatDateAndTimePickerButton,
  FormatSeparator,
} from '@/app/ui/menus/Toolbar/FormattingBar/components';
import {
  BorderAllIcon,
  FormatAlignLeftIcon,
  FormatTextWrapIcon,
  MoreVertIcon,
  VerticalAlignTopIcon,
} from '@/shared/components/Icons';
import { cn } from '@/shared/shadcn/utils';
import { ToggleGroup } from 'radix-ui';
import { forwardRef } from 'react';

const convertFormatSummaryToValue = (formatSummary: CellFormatSummary | undefined) => {
  if (!formatSummary) return [];
  const result = [];
  if (formatSummary.commas === true) result.push(defaultActionSpec[Action.FormatNumberToggleCommas].label());
  console.log(result);
  return result;
};

export const NumberFormatting = forwardRef<
  HTMLDivElement | null,
  { className?: string; formatSummary: CellFormatSummary | undefined }
>((props, ref) => (
  <ToggleGroup.Root
    type="multiple"
    className={cn('flex select-none text-sm', props.className)}
    onValueChange={() => focusGrid()}
    value={convertFormatSummaryToValue(props.formatSummary)}
    ref={ref}
  >
    <FormatButton action={Action.FormatNumberToggleCommas} actionArgs={undefined} />
    <FormatButton action={Action.FormatNumberDecimalDecrease} actionArgs={undefined} />
    <FormatButton action={Action.FormatNumberDecimalIncrease} actionArgs={undefined} />
    <FormatButton action={Action.FormatNumberCurrency} actionArgs={undefined} />
    <FormatButton action={Action.FormatNumberPercent} actionArgs={undefined} />
    <FormatButton action={Action.FormatNumberAutomatic} actionArgs={undefined} />
    <FormatSeparator />
  </ToggleGroup.Root>
));

export const DateFormatting = forwardRef<HTMLDivElement | null, { className?: string }>((props, ref) => (
  <ToggleGroup.Root
    type="multiple"
    className={cn('flex select-none text-sm', props.className)}
    onValueChange={() => focusGrid()}
    ref={ref}
  >
    <FormatDateAndTimePickerButton />
    <FormatSeparator />
  </ToggleGroup.Root>
));

export const TextFormatting = forwardRef<HTMLDivElement | null, { className?: string }>((props, ref) => (
  <ToggleGroup.Root
    type="multiple"
    className={cn('flex select-none text-sm', props.className)}
    onValueChange={() => focusGrid()}
    ref={ref}
  >
    <FormatButton action={Action.ToggleBold} actionArgs={undefined} />
    <FormatButton action={Action.ToggleItalic} actionArgs={undefined} />
    <FormatButton action={Action.ToggleUnderline} actionArgs={undefined} />
    <FormatButton action={Action.ToggleStrikeThrough} actionArgs={undefined} />
    <FormatColorPickerButton action={Action.FormatTextColor} />
    <FormatSeparator />
  </ToggleGroup.Root>
));

export const FillAndBorderFormatting = forwardRef<HTMLDivElement | null, { className?: string }>((props, ref) => (
  <ToggleGroup.Root
    type="multiple"
    className={cn('flex select-none text-sm', props.className)}
    onValueChange={() => focusGrid()}
    ref={ref}
  >
    <FormatColorPickerButton action={Action.FormatFillColor} />
    <FormatButtonPopover tooltipLabel="Borders" Icon={BorderAllIcon} className="flex flex-row flex-wrap">
      <BorderMenu />
    </FormatButtonPopover>
    <FormatSeparator />
  </ToggleGroup.Root>
));

export const AlignmentFormatting = forwardRef<HTMLDivElement | null, { className?: string }>((props, ref) => (
  <ToggleGroup.Root
    type="multiple"
    className={cn('flex select-none text-sm', props.className)}
    onValueChange={() => focusGrid()}
    ref={ref}
  >
    <FormatButtonDropdown showDropdownArrow tooltipLabel="Horizontal align" Icon={FormatAlignLeftIcon}>
      <FormatButtonDropdownActions
        actions={[
          Action.FormatAlignHorizontalLeft,
          Action.FormatAlignHorizontalCenter,
          Action.FormatAlignHorizontalRight,
        ]}
        actionArgs={undefined}
      />
    </FormatButtonDropdown>
    <FormatButtonDropdown showDropdownArrow tooltipLabel="Vertical align" Icon={VerticalAlignTopIcon}>
      <FormatButtonDropdownActions
        actions={[Action.FormatAlignVerticalTop, Action.FormatAlignVerticalMiddle, Action.FormatAlignVerticalBottom]}
        actionArgs={undefined}
      />
    </FormatButtonDropdown>
    <FormatButtonDropdown showDropdownArrow tooltipLabel="Text wrap" Icon={FormatTextWrapIcon}>
      <FormatButtonDropdownActions
        actions={[Action.FormatTextWrapWrap, Action.FormatTextWrapOverflow, Action.FormatTextWrapClip]}
        actionArgs={undefined}
      />
    </FormatButtonDropdown>
    <FormatSeparator />
  </ToggleGroup.Root>
));

export const Clear = forwardRef<HTMLDivElement | null, { className?: string }>((props, ref) => (
  <ToggleGroup.Root
    type="multiple"
    className={cn('flex select-none text-sm', props.className)}
    onValueChange={() => focusGrid()}
    ref={ref}
    {...props}
  >
    <FormatButton action={Action.ClearFormattingBorders} actionArgs={undefined} />
  </ToggleGroup.Root>
));

export const FormatMoreButton = forwardRef<
  HTMLDivElement | null,
  { setShowMore: (showMore: boolean) => void; showMore: boolean }
>((props, ref) => (
  <ToggleGroup.Root
    type="multiple"
    className="relative flex h-full items-center px-2 text-muted-foreground hover:bg-accent hover:text-foreground focus:bg-accent focus:text-foreground focus:outline-none"
    onValueChange={() => props.setShowMore(!props.showMore)}
    ref={ref}
  >
    <MoreVertIcon />
  </ToggleGroup.Root>
));
