import { Action } from '@/app/actions/actions';
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
  FormatAlignCenterIcon,
  FormatAlignLeftIcon,
  FormatAlignRightIcon,
  FormatTextClipIcon,
  FormatTextOverflowIcon,
  FormatTextWrapIcon,
  MoreVertIcon,
  VerticalAlignBottomIcon,
  VerticalAlignMiddleIcon,
  VerticalAlignTopIcon,
} from '@/shared/components/Icons';
import { cn } from '@/shared/shadcn/utils';
import { ToggleGroup } from 'radix-ui';
import { forwardRef } from 'react';

export const NumberFormatting = forwardRef<
  HTMLDivElement | null,
  { className?: string; formatSummary: CellFormatSummary | undefined }
>((props, ref) => (
  <div className={cn('flex select-none text-sm', props.className)} ref={ref}>
    <FormatButton
      action={Action.FormatNumberToggleCommas}
      actionArgs={undefined}
      checked={props.formatSummary?.commas}
    />
    <FormatButton action={Action.FormatNumberDecimalDecrease} actionArgs={undefined} />
    <FormatButton action={Action.FormatNumberDecimalIncrease} actionArgs={undefined} />
    <FormatButton
      action={Action.FormatNumberCurrency}
      actionArgs={undefined}
      checked={props.formatSummary?.numericFormat?.type === 'CURRENCY'}
    />
    <FormatButton
      action={Action.FormatNumberPercent}
      actionArgs={undefined}
      checked={props.formatSummary?.numericFormat?.type === 'PERCENTAGE'}
    />
    <FormatButton action={Action.FormatNumberAutomatic} actionArgs={undefined} />
    <FormatSeparator />
  </div>
));

export const DateFormatting = forwardRef<HTMLDivElement | null, { className?: string }>((props, ref) => (
  <div className={cn('flex select-none text-sm', props.className)} ref={ref}>
    <FormatDateAndTimePickerButton />
    <FormatSeparator />
  </div>
));

export const TextFormatting = forwardRef<
  HTMLDivElement | null,
  { className?: string; formatSummary: CellFormatSummary | undefined }
>((props, ref) => (
  <div className={cn('flex select-none text-sm', props.className)} ref={ref}>
    <FormatButton action={Action.ToggleBold} actionArgs={undefined} checked={props.formatSummary?.bold} />
    <FormatButton action={Action.ToggleItalic} actionArgs={undefined} checked={props.formatSummary?.italic} />
    <FormatButton action={Action.ToggleUnderline} actionArgs={undefined} checked={props.formatSummary?.underline} />
    <FormatButton
      action={Action.ToggleStrikeThrough}
      actionArgs={undefined}
      checked={props.formatSummary?.strikeThrough}
    />
    <FormatColorPickerButton
      action={Action.FormatTextColor}
      activeColor={props.formatSummary?.textColor ?? undefined}
    />
    <FormatSeparator />
  </div>
));

export const FillAndBorderFormatting = forwardRef<
  HTMLDivElement | null,
  { className?: string; formatSummary: CellFormatSummary | undefined }
>((props, ref) => (
  <div className={cn('flex select-none text-sm', props.className)} ref={ref}>
    <FormatColorPickerButton
      action={Action.FormatFillColor}
      activeColor={props.formatSummary?.fillColor ?? undefined}
    />
    <FormatButtonPopover tooltipLabel="Borders" Icon={BorderAllIcon} className="flex flex-row flex-wrap">
      <BorderMenu />
    </FormatButtonPopover>
    <FormatSeparator />
  </div>
));

export const AlignmentFormatting = forwardRef<
  HTMLDivElement | null,
  { className?: string; formatSummary: CellFormatSummary | undefined }
>((props, ref) => {
  let AlignIcon = FormatAlignLeftIcon;
  if (props.formatSummary?.align === 'center') AlignIcon = FormatAlignCenterIcon;
  if (props.formatSummary?.align === 'right') AlignIcon = FormatAlignRightIcon;

  let VerticalAlignIcon = VerticalAlignTopIcon;
  if (props.formatSummary?.verticalAlign === 'middle') VerticalAlignIcon = VerticalAlignMiddleIcon;
  if (props.formatSummary?.verticalAlign === 'bottom') VerticalAlignIcon = VerticalAlignBottomIcon;

  let TextWrapIcon = FormatTextOverflowIcon;
  if (props.formatSummary?.wrap === 'wrap') TextWrapIcon = FormatTextWrapIcon;
  if (props.formatSummary?.wrap === 'clip') TextWrapIcon = FormatTextClipIcon;

  return (
    <div className={cn('flex select-none text-sm', props.className)} ref={ref}>
      <FormatButtonDropdown showDropdownArrow tooltipLabel="Horizontal align" Icon={AlignIcon}>
        <FormatButtonDropdownActions
          actions={[
            Action.FormatAlignHorizontalLeft,
            Action.FormatAlignHorizontalCenter,
            Action.FormatAlignHorizontalRight,
          ]}
          actionArgs={undefined}
        />
      </FormatButtonDropdown>
      <FormatButtonDropdown showDropdownArrow tooltipLabel="Vertical align" Icon={VerticalAlignIcon}>
        <FormatButtonDropdownActions
          actions={[Action.FormatAlignVerticalTop, Action.FormatAlignVerticalMiddle, Action.FormatAlignVerticalBottom]}
          actionArgs={undefined}
        />
      </FormatButtonDropdown>
      <FormatButtonDropdown showDropdownArrow tooltipLabel="Text wrap" Icon={TextWrapIcon}>
        <FormatButtonDropdownActions
          actions={[Action.FormatTextWrapOverflow, Action.FormatTextWrapWrap, Action.FormatTextWrapClip]}
          actionArgs={undefined}
        />
      </FormatButtonDropdown>
      <FormatSeparator />
    </div>
  );
});

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
    className="relative flex h-full cursor-pointer items-center px-2 text-muted-foreground hover:bg-accent hover:text-foreground focus:bg-accent focus:text-foreground focus:outline-none"
    onValueChange={() => props.setShowMore(!props.showMore)}
    ref={ref}
  >
    <MoreVertIcon />
  </ToggleGroup.Root>
));
