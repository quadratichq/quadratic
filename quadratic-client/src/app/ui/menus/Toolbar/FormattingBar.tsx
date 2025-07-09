import { Action } from '@/app/actions/actions';
import type { ActionArgs } from '@/app/actions/actionsSpec';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { focusGrid } from '@/app/helpers/focusGrid';
import { keyboardShortcutEnumToDisplay } from '@/app/helpers/keyboardShortcutsDisplay';
import { BorderMenu } from '@/app/ui/components/BorderMenu';
import { DateFormat } from '@/app/ui/components/DateFormat';
import { QColorPicker } from '@/app/ui/components/qColorPicker';
import {
  ArrowDropDownIcon,
  BorderAllIcon,
  FormatAlignLeftIcon,
  FormatTextWrapIcon,
  MoreVertIcon,
  VerticalAlignTopIcon,
} from '@/shared/components/Icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/shadcn/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import mixpanel from 'mixpanel-browser';
import { ToggleGroup } from 'radix-ui';
import { forwardRef, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

const NumberFormatting = forwardRef<HTMLDivElement | null, { className?: string }>((props, ref) => (
  <ToggleGroup.Root
    type="multiple"
    className={cn('flex select-none text-sm', props.className)}
    onValueChange={() => {
      focusGrid();
    }}
    ref={ref}
  >
    <FormatButton action={Action.FormatNumberToggleCommas} actionArgs={undefined} />
    <FormatButton action={Action.FormatNumberDecimalDecrease} actionArgs={undefined} />
    <FormatButton action={Action.FormatNumberDecimalIncrease} actionArgs={undefined} />
    <FormatButton action={Action.FormatNumberCurrency} actionArgs={undefined} />
    <FormatButton action={Action.FormatNumberPercent} actionArgs={undefined} />
    <FormatButton action={Action.FormatNumberAutomatic} actionArgs={undefined} />
    <Separator />
  </ToggleGroup.Root>
));

const DateFormatting = forwardRef<HTMLDivElement | null, { className?: string }>((props, ref) => (
  <ToggleGroup.Root
    type="multiple"
    className={cn('flex select-none text-sm', props.className)}
    onValueChange={() => {
      focusGrid();
    }}
    ref={ref}
  >
    <FormatDateAndTimePickerButton />
    <Separator />
  </ToggleGroup.Root>
));

const TextFormatting = forwardRef<HTMLDivElement | null, { className?: string }>((props, ref) => (
  <ToggleGroup.Root
    type="multiple"
    className={cn('flex select-none text-sm', props.className)}
    onValueChange={() => {
      focusGrid();
    }}
    ref={ref}
  >
    <FormatButton action={Action.ToggleBold} actionArgs={undefined} />
    <FormatButton action={Action.ToggleItalic} actionArgs={undefined} />
    <FormatButton action={Action.ToggleUnderline} actionArgs={undefined} />
    <FormatButton action={Action.ToggleStrikeThrough} actionArgs={undefined} />
    <FormatColorPickerButton action={Action.FormatTextColor} />
    <Separator />
  </ToggleGroup.Root>
));

const FillAndBorderFormatting = forwardRef<HTMLDivElement | null, { className?: string }>((props, ref) => (
  <ToggleGroup.Root
    type="multiple"
    className={cn('flex select-none text-sm', props.className)}
    onValueChange={() => {
      focusGrid();
    }}
    ref={ref}
  >
    <FormatColorPickerButton action={Action.FormatFillColor} />
    <FormatButtonPopover tooltipLabel="Borders" Icon={BorderAllIcon} className="flex flex-row flex-wrap">
      <BorderMenu />
    </FormatButtonPopover>
    <Separator />
  </ToggleGroup.Root>
));

const AlignmentFormatting = forwardRef<HTMLDivElement | null, { className?: string }>((props, ref) => (
  <ToggleGroup.Root
    type="multiple"
    className={cn('flex select-none text-sm', props.className)}
    onValueChange={() => {
      focusGrid();
    }}
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
    <Separator />
  </ToggleGroup.Root>
));

const Clear = forwardRef<HTMLDivElement | null, { className?: string }>((props, ref) => (
  <ToggleGroup.Root
    type="multiple"
    className={cn('flex select-none text-sm', props.className)}
    onValueChange={() => {
      focusGrid();
    }}
    ref={ref}
    {...props}
  >
    <FormatButton action={Action.ClearFormattingBorders} actionArgs={undefined} />
  </ToggleGroup.Root>
));

type FormattingTypes =
  | 'NumberFormatting'
  | 'DateFormatting'
  | 'TextFormatting'
  | 'FillAndBorderFormatting'
  | 'AlignmentFormatting'
  | 'Clear';

export const FormattingBar = () => {
  const [hiddenItems, setHiddenItems] = useState<FormattingTypes[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLDivElement>(null);

  const numberFormattingRef = useRef<HTMLDivElement>(null);
  const dateFormattingRef = useRef<HTMLDivElement>(null);
  const textFormattingRef = useRef<HTMLDivElement>(null);
  const fillAndBorderFormattingRef = useRef<HTMLDivElement>(null);
  const alignmentFormattingRef = useRef<HTMLDivElement>(null);
  const clearRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refs: Record<FormattingTypes, RefObject<HTMLDivElement | null>> = {
      NumberFormatting: numberFormattingRef,
      DateFormatting: dateFormattingRef,
      TextFormatting: textFormattingRef,
      FillAndBorderFormatting: fillAndBorderFormattingRef,
      AlignmentFormatting: alignmentFormattingRef,
      Clear: clearRef,
    };

    // check if any of the formatting groups are too wide to fit on the formatting bar
    const checkFit = () => {
      // ensure all refs are defined before checking fit
      if (!menuRef.current || !moreButtonRef.current) return;
      for (const ref in refs) {
        if (!refs[ref as FormattingTypes].current) return;
      }

      const menuWidth = menuRef.current?.clientWidth;
      const keys = Object.keys(refs) as FormattingTypes[];
      let currentWidth = moreButtonRef.current?.clientWidth ?? 0;
      const hiddenItems: FormattingTypes[] = [];
      for (const key of keys) {
        const itemWidth = refs[key].current?.clientWidth;
        if (itemWidth) {
          currentWidth += itemWidth;
          if (currentWidth > menuWidth) {
            hiddenItems.push(key);
          }
        }
      }
      console.log(hiddenItems);
      setHiddenItems(hiddenItems);
    };

    checkFit();
    window.addEventListener('resize', checkFit);
    return () => {
      window.removeEventListener('resize', checkFit);
    };
  }, []);

  return (
    <div className="flex w-full flex-grow">
      <div ref={menuRef} className="flex flex-shrink select-none text-sm">
        <NumberFormatting
          ref={numberFormattingRef}
          className={hiddenItems.includes('NumberFormatting') ? 'invisible' : ''}
        />
        <DateFormatting ref={dateFormattingRef} className={hiddenItems.includes('DateFormatting') ? 'invisible' : ''} />
        <TextFormatting ref={textFormattingRef} className={hiddenItems.includes('TextFormatting') ? 'invisible' : ''} />
        <FillAndBorderFormatting
          ref={fillAndBorderFormattingRef}
          className={hiddenItems.includes('FillAndBorderFormatting') ? 'invisible' : ''}
        />
        <AlignmentFormatting
          ref={alignmentFormattingRef}
          className={hiddenItems.includes('AlignmentFormatting') ? 'invisible' : ''}
        />
        <Clear ref={clearRef} className={hiddenItems.includes('Clear') ? 'invisible' : ''} />
      </div>
      <ToggleGroup.Root type="multiple" className="flex select-none text-sm" ref={moreButtonRef}>
        <div className={hiddenItems.length === 0 ? 'invisible' : ''}>
          <FormatButtonDropdown Icon={MoreVertIcon} tooltipLabel="More" className="grid grid-cols-1 gap-1 p-1">
            <div className="flex select-none overflow-hidden text-sm">
              {hiddenItems.includes('NumberFormatting') && <NumberFormatting />}
              {hiddenItems.includes('DateFormatting') && <DateFormatting />}
              {hiddenItems.includes('TextFormatting') && <TextFormatting />}
              {hiddenItems.includes('FillAndBorderFormatting') && <FillAndBorderFormatting />}
              {hiddenItems.includes('AlignmentFormatting') && <AlignmentFormatting />}
              {hiddenItems.includes('Clear') && <Clear />}
            </div>
          </FormatButtonDropdown>
        </div>
      </ToggleGroup.Root>
    </div>
  );
};

function Separator() {
  return <hr className="relative mx-1.5 mt-1.5 h-2/3 w-[1px] bg-border" />;
}

function FormatButtonDropdown({
  Icon,
  tooltipLabel,
  children,
  showDropdownArrow,
  className,
  disableCloseAutoFocus,
}: {
  Icon: any;
  children: ReactNode;
  tooltipLabel: string;
  showDropdownArrow?: boolean;
  className?: string;
  disableCloseAutoFocus?: boolean;
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <ToggleGroup.Item value={tooltipLabel} asChild aria-label={tooltipLabel}>
            <DropdownMenuTrigger className="flex h-full items-center px-2 text-muted-foreground hover:bg-accent hover:text-foreground focus:bg-accent focus:text-foreground focus:outline-none aria-expanded:bg-accent aria-expanded:text-foreground">
              <Icon />
              {showDropdownArrow && <ArrowDropDownIcon className="-ml-1 -mr-2" />}
            </DropdownMenuTrigger>
          </ToggleGroup.Item>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <TooltipContents label={tooltipLabel} />
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        className={className}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          focusGrid();
        }}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FormatButtonPopover({
  Icon,
  tooltipLabel,
  children,
  showDropdownArrow,
  className,
}: {
  Icon: any;
  children: ReactNode;
  tooltipLabel: string;
  showDropdownArrow?: boolean;
  className?: string;
}) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <ToggleGroup.Item value={tooltipLabel} asChild aria-label={tooltipLabel}>
            <PopoverTrigger className="flex h-full items-center px-2 text-muted-foreground hover:bg-accent hover:text-foreground focus:bg-accent focus:text-foreground focus:outline-none aria-expanded:bg-accent aria-expanded:text-foreground">
              <Icon />
              {showDropdownArrow && <ArrowDropDownIcon className="-ml-1 -mr-2" />}
            </PopoverTrigger>
          </ToggleGroup.Item>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <TooltipContents label={tooltipLabel} />
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        className={className + ' w-fit p-1'}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          focusGrid();
        }}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

function FormatButtonDropdownActions<T extends Action>({
  actions,
  actionArgs,
}: {
  actions: T[];
  actionArgs: T extends keyof ActionArgs ? ActionArgs[T] : void;
}) {
  return actions.map((action, key) => {
    const actionSpec = defaultActionSpec[action];
    const label = actionSpec.label();
    const Icon = 'Icon' in actionSpec ? actionSpec.Icon : undefined;
    return (
      <DropdownMenuItem
        key={key}
        onClick={() => {
          mixpanel.track('[FormattingBar].button', { label });
          actionSpec.run(actionArgs);
        }}
      >
        {Icon && <Icon className="mr-2" />}
        {label}
      </DropdownMenuItem>
    );
  });
}

function FormatButton<T extends Action>({
  action,
  actionArgs,
}: {
  action: T;
  actionArgs: T extends keyof ActionArgs ? ActionArgs[T] : void;
}) {
  const actionSpec = defaultActionSpec[action];
  const label = actionSpec.label();
  const Icon = 'Icon' in actionSpec ? actionSpec.Icon : undefined;
  const keyboardShortcut = keyboardShortcutEnumToDisplay(action);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ToggleGroup.Item
          aria-label={label}
          value={label}
          className="flex h-full items-center px-2 text-muted-foreground hover:bg-accent hover:text-foreground focus:bg-accent focus:text-foreground focus:outline-none"
          onClick={() => {
            mixpanel.track('[FormattingBar].button', { label });
            actionSpec.run(actionArgs);
          }}
        >
          {Icon && <Icon />}
        </ToggleGroup.Item>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <TooltipContents label={label} keyboardShortcut={keyboardShortcut} />
      </TooltipContent>
    </Tooltip>
  );
}

function FormatColorPickerButton({
  action,
  activeColor,
}: {
  action: Action.FormatTextColor | Action.FormatFillColor;
  activeColor?: string;
}) {
  const actionSpec = defaultActionSpec[action];
  const label = actionSpec.label();
  const Icon = 'Icon' in actionSpec ? actionSpec.Icon : undefined;

  return (
    <FormatButtonDropdown tooltipLabel={label} Icon={Icon}>
      <DropdownMenuItem className="color-picker-dropdown-menu flex flex-col !bg-background p-0">
        <QColorPicker
          onChangeComplete={(color) => {
            actionSpec.run(color);
            focusGrid();
          }}
          onClear={() => {
            actionSpec.run(undefined);
            focusGrid();
          }}
        />
      </DropdownMenuItem>
    </FormatButtonDropdown>
  );
}

function FormatDateAndTimePickerButton() {
  const dateAndTimeAction = defaultActionSpec[Action.FormatDateTime];
  const label = dateAndTimeAction.label();

  return (
    <FormatButtonPopover tooltipLabel={label} Icon={dateAndTimeAction.Icon}>
      <div className="min-w-80 p-2">
        <DateFormat
          closeMenu={() => {
            focusGrid();
          }}
        />
      </div>
    </FormatButtonPopover>
  );
}

export function TooltipContents({ label, keyboardShortcut }: { label: string; keyboardShortcut?: string }) {
  return (
    <p>
      {label}{' '}
      {keyboardShortcut && (
        <span className="opacity-50 before:content-['('] after:content-[')']">{keyboardShortcut}</span>
      )}
    </p>
  );
}
