//! These are the components that are used to render the Formatting Bar.
//! Components that don't fit in the main bar are moved to the sub-bar.
//!
//! Note that the hideLabel prop is used to hide the label of the button when
//! measuring the widths.

import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import type { CellFormatSummary } from '@/app/quadratic-core-types';
import { BorderMenu } from '@/app/ui/components/BorderMenu';
import {
  FormatButton,
  FormatButtonDropdown,
  FormatButtonDropdownActions,
  FormatButtonPopover,
  FormatColorPickerButton,
  FormatCurrencyButton,
  FormatDateAndTimePickerButton,
  FormatSeparator,
} from '@/app/ui/menus/Toolbar/FormattingBar/components';
import {
  BorderAllIcon,
  CheckIcon,
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
import { DEFAULT_FONT_SIZE, FONT_SIZES, FONT_SIZE_DISPLAY_ADJUSTMENT } from '@/shared/constants/gridConstants';
import { DropdownMenuItem } from '@/shared/shadcn/ui/dropdown-menu';
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
      <FormatCurrencyButton formatSummary={props.formatSummary} hideLabel={props.hideLabel} />
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
      <FormatButton action={Action.InsertHyperlink} actionArgs={undefined} hideLabel={props.hideLabel} />
      <FormatSeparator />
    </div>
  ))
);

export const FontSizeFormatting = memo(
  forwardRef<
    HTMLDivElement | null,
    { className?: string; formatSummary?: CellFormatSummary | undefined; hideLabel?: boolean }
  >((props, ref) => {
    const currentFontSize = props.formatSummary?.fontSize ?? DEFAULT_FONT_SIZE;
    const displayFontSize = currentFontSize + FONT_SIZE_DISPLAY_ADJUSTMENT;

    return (
      <div className={cn('flex select-none items-center gap-1 text-sm', props.className)} ref={ref}>
        <div className="flex items-center -space-x-px">
          <FormatButton
            action={Action.FormatFontSizeDecrease}
            actionArgs={undefined}
            hideLabel={props.hideLabel}
            enableHoldToRepeat={true}
          />
          <FormatButtonDropdown
            action="font-size"
            tooltipLabel="Font size"
            Icon={null}
            IconNode={<span className="text-xs">{displayFontSize}</span>}
            hideLabel={props.hideLabel}
          >
            <div className="max-h-full overflow-y-auto">
              {FONT_SIZES.map((displaySize) => {
                const actionSpec = defaultActionSpec[Action.FormatFontSize];
                // Convert display value (user-facing) to internal value
                const internalSize = displaySize - FONT_SIZE_DISPLAY_ADJUSTMENT;
                const defaultDisplaySize = DEFAULT_FONT_SIZE + FONT_SIZE_DISPLAY_ADJUSTMENT;
                const isDefault = displaySize === defaultDisplaySize;
                const isSelected = displaySize === displayFontSize;
                return (
                  <DropdownMenuItem
                    key={displaySize}
                    onClick={() => {
                      actionSpec.run(internalSize);
                    }}
                    aria-label={
                      props.hideLabel
                        ? ''
                        : `${displaySize}px${isDefault ? ' (default)' : ''}${isSelected ? ' (selected)' : ''}`
                    }
                    className="py-1.5"
                  >
                    <CheckIcon className={cn('mr-2 flex-shrink-0', isSelected ? 'visible' : 'invisible opacity-0')} />
                    {displaySize}
                    {isDefault && <span className="ml-1 text-muted-foreground">(default)</span>}
                  </DropdownMenuItem>
                );
              })}
            </div>
          </FormatButtonDropdown>
          <FormatButton
            action={Action.FormatFontSizeIncrease}
            actionArgs={undefined}
            hideLabel={props.hideLabel}
            enableHoldToRepeat={true}
          />
        </div>
        <FormatSeparator />
      </div>
    );
  })
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

    // the default vertical align is bottom
    let VerticalAlignIcon = VerticalAlignBottomIcon;
    if (props.formatSummary?.verticalAlign === 'middle') VerticalAlignIcon = VerticalAlignMiddleIcon;
    if (props.formatSummary?.verticalAlign === 'top') VerticalAlignIcon = VerticalAlignTopIcon;

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
            isChecked={(action) => {
              if (action === Action.FormatAlignHorizontalLeft) return props.formatSummary?.align === 'left';
              if (action === Action.FormatAlignHorizontalCenter) return props.formatSummary?.align === 'center';
              if (action === Action.FormatAlignHorizontalRight) return props.formatSummary?.align === 'right';
              return false;
            }}
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
            isChecked={(action) => {
              if (action === Action.FormatAlignVerticalTop) return props.formatSummary?.verticalAlign === 'top';
              if (action === Action.FormatAlignVerticalMiddle) return props.formatSummary?.verticalAlign === 'middle';
              if (action === Action.FormatAlignVerticalBottom) return props.formatSummary?.verticalAlign === 'bottom';
              return false;
            }}
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
            isChecked={(action) => {
              if (action === Action.FormatTextWrapOverflow) return props.formatSummary?.wrap === 'overflow';
              if (action === Action.FormatTextWrapWrap) return props.formatSummary?.wrap === 'wrap';
              if (action === Action.FormatTextWrapClip) return props.formatSummary?.wrap === 'clip';
              return false;
            }}
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
        data-testid="more-formatting-icon"
      >
        <MoreVertIcon />
      </ToggleGroup.Root>
    </div>
  ))
);
