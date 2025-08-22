//! These are the components that are used to render the Formatting Bar.
//! Components that don't fit in the main bar are moved to the sub-bar.
//!
//! Note that the hideLabel prop is used to hide the label of the button when
//! measuring the widths.

import { Action } from '@/app/actions/actions';
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
import { forwardRef, memo } from 'react';

export const NumberFormatting = memo(
  forwardRef<
    HTMLDivElement | null,
    { className?: string; formatSummary: CellFormatSummary | undefined; hideLabel?: boolean }
  >((props, ref) => (
    <div className={cn('flex select-none items-center gap-1 text-sm', props.className)} ref={ref}>
      <FormatButton
        action={Action.FormatNumberToggleCommas}
        actionArgs={undefined}
        checked={props.formatSummary?.commas}
        hideLabel={props.hideLabel}
      />
      <FormatButton action={Action.FormatNumberDecimalDecrease} actionArgs={undefined} hideLabel={props.hideLabel} />
      <FormatButton action={Action.FormatNumberDecimalIncrease} actionArgs={undefined} hideLabel={props.hideLabel} />
      <FormatButton
        action={Action.FormatNumberCurrency}
        actionArgs={undefined}
        checked={props.formatSummary?.numericFormat?.type === 'CURRENCY'}
        hideLabel={props.hideLabel}
      />
      <FormatButton
        action={Action.FormatNumberPercent}
        actionArgs={undefined}
        checked={props.formatSummary?.numericFormat?.type === 'PERCENTAGE'}
        hideLabel={props.hideLabel}
      />
      <FormatButton action={Action.FormatNumberAutomatic} actionArgs={undefined} hideLabel={props.hideLabel} />
      <FormatSeparator />
    </div>
  ))
);

export const DateFormatting = memo(
  forwardRef<HTMLDivElement | null, { className?: string; hideLabel?: boolean }>((props, ref) => (
    <div className={cn('flex select-none items-center text-sm', props.className)} ref={ref}>
      <FormatDateAndTimePickerButton hideLabel={props.hideLabel} />
      <FormatSeparator />
    </div>
  ))
);

export const TextFormatting = memo(
  forwardRef<
    HTMLDivElement | null,
    { className?: string; formatSummary: CellFormatSummary | undefined; hideLabel?: boolean }
  >((props, ref) => (
    <div className={cn('flex select-none items-center gap-1 text-sm', props.className)} ref={ref}>
      <FormatButton
        action={Action.ToggleBold}
        actionArgs={undefined}
        checked={props.formatSummary?.bold}
        hideLabel={props.hideLabel}
      />
      <FormatButton
        action={Action.ToggleItalic}
        actionArgs={undefined}
        checked={props.formatSummary?.italic}
        hideLabel={props.hideLabel}
      />
      <FormatButton
        action={Action.ToggleUnderline}
        actionArgs={undefined}
        checked={props.formatSummary?.underline}
        hideLabel={props.hideLabel}
      />
      <FormatButton
        action={Action.ToggleStrikeThrough}
        actionArgs={undefined}
        checked={props.formatSummary?.strikeThrough}
        hideLabel={props.hideLabel}
      />
      <FormatColorPickerButton
        action={Action.FormatTextColor}
        activeColor={props.formatSummary?.textColor ?? undefined}
        hideLabel={props.hideLabel}
      />
      <FormatSeparator />
    </div>
  ))
);

export const FillAndBorderFormatting = memo(
  forwardRef<
    HTMLDivElement | null,
    { className?: string; formatSummary: CellFormatSummary | undefined; hideLabel?: boolean }
  >((props, ref) => (
    <div className={cn('flex select-none items-center gap-1 text-sm', props.className)} ref={ref}>
      <FormatColorPickerButton
        action={Action.FormatFillColor}
        activeColor={props.formatSummary?.fillColor ?? undefined}
        hideLabel={props.hideLabel}
      />
      <FormatButtonPopover
        action="borders"
        tooltipLabel="Borders"
        Icon={BorderAllIcon}
        className="flex flex-row flex-wrap"
        hideLabel={props.hideLabel}
      >
        <BorderMenu />
      </FormatButtonPopover>
      <FormatSeparator />
    </div>
  ))
);

export const AlignmentFormatting = memo(
  forwardRef<
    HTMLDivElement | null,
    { className?: string; formatSummary: CellFormatSummary | undefined; hideLabel?: boolean }
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
      <div className={cn('flex select-none items-center gap-1 text-sm', props.className)} ref={ref}>
        <FormatButtonDropdown
          action="horizontal-align"
          tooltipLabel="Horizontal align"
          Icon={AlignIcon}
          hideLabel={props.hideLabel}
        >
          <FormatButtonDropdownActions
            actions={[
              Action.FormatAlignHorizontalLeft,
              Action.FormatAlignHorizontalCenter,
              Action.FormatAlignHorizontalRight,
            ]}
            actionArgs={undefined}
            hideLabel={props.hideLabel}
          />
        </FormatButtonDropdown>
        <FormatButtonDropdown
          action="vertical-align"
          tooltipLabel="Vertical align"
          Icon={VerticalAlignIcon}
          hideLabel={props.hideLabel}
        >
          <FormatButtonDropdownActions
            actions={[
              Action.FormatAlignVerticalTop,
              Action.FormatAlignVerticalMiddle,
              Action.FormatAlignVerticalBottom,
            ]}
            actionArgs={undefined}
            hideLabel={props.hideLabel}
          />
        </FormatButtonDropdown>
        <FormatButtonDropdown
          action="text-wrap"
          tooltipLabel="Text wrap"
          Icon={TextWrapIcon}
          hideLabel={props.hideLabel}
        >
          <FormatButtonDropdownActions
            actions={[Action.FormatTextWrapOverflow, Action.FormatTextWrapWrap, Action.FormatTextWrapClip]}
            actionArgs={undefined}
            hideLabel={props.hideLabel}
          />
        </FormatButtonDropdown>
        <FormatSeparator />
      </div>
    );
  })
);

export const Clear = memo(
  forwardRef<HTMLDivElement | null, { className?: string; hideLabel?: boolean }>((props, ref) => (
    <div className={cn('flex select-none items-center gap-1 text-sm', props.className)} ref={ref}>
      <FormatButton action={Action.ClearFormattingBorders} actionArgs={undefined} hideLabel={props.hideLabel} />
    </div>
  ))
);

export const FormatMoreButton = memo(
  forwardRef<HTMLDivElement | null, { setShowMore: (showMore: boolean) => void; showMore: boolean }>((props, ref) => (
    <div className={cn('flex select-none items-center gap-1 text-sm')}>
      <ToggleGroup.Root
        type="multiple"
        className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus:bg-accent focus:text-foreground focus:outline-none"
        onValueChange={() => props.setShowMore(!props.showMore)}
        ref={ref}
      >
        <MoreVertIcon />
      </ToggleGroup.Root>
    </div>
  ))
);
