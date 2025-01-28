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
  Number123Icon,
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
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import mixpanel from 'mixpanel-browser';
import type { ReactNode } from 'react';

export const FormattingBar = () => {
  return (
    <ToggleGroup.Root
      type="multiple"
      className="flex select-none text-sm"
      onValueChange={() => {
        focusGrid();
      }}
    >
      <FormatButton action={Action.FormatNumberToggleCommas} actionArgs={undefined} />
      <FormatButton action={Action.FormatNumberDecimalDecrease} actionArgs={undefined} />
      <FormatButton action={Action.FormatNumberDecimalIncrease} actionArgs={undefined} />
      <FormatButton action={Action.FormatNumberCurrency} actionArgs={undefined} />
      <FormatButton action={Action.FormatNumberPercent} actionArgs={undefined} />
      <FormatButtonDropdown showDropdownArrow tooltipLabel="More number formats" Icon={Number123Icon}>
        <FormatButtonDropdownActions
          actions={[Action.FormatNumberAutomatic, Action.FormatNumberScientific]}
          actionArgs={undefined}
        />
      </FormatButtonDropdown>

      <Separator />

      <FormatDateAndTimePickerButton />

      <Separator />

      <FormatButton action={Action.ToggleBold} actionArgs={undefined} />
      <FormatButton action={Action.ToggleItalic} actionArgs={undefined} />
      <FormatButton action={Action.ToggleUnderline} actionArgs={undefined} />
      <FormatButton action={Action.ToggleStrikeThrough} actionArgs={undefined} />
      <FormatColorPickerButton action={Action.FormatTextColor} />

      <Separator />

      <FormatColorPickerButton action={Action.FormatFillColor} />
      <FormatButtonPopover
        disableCloseAutoFocus
        tooltipLabel="Borders"
        Icon={BorderAllIcon}
        className="flex flex-row flex-wrap"
      >
        <BorderMenu />
      </FormatButtonPopover>

      <Separator />

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

      <FormatButton action={Action.ClearFormattingBorders} actionArgs={undefined} />
    </ToggleGroup.Root>
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
    const { label, run } = actionSpec;
    const Icon = 'Icon' in actionSpec ? actionSpec.Icon : undefined;
    return (
      <DropdownMenuItem
        key={key}
        onClick={() => {
          mixpanel.track('[FormattingBar].button', { label });
          run(actionArgs);
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
  const { label, run } = actionSpec;
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
            run(actionArgs);
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
  const { label, run } = actionSpec;
  const Icon = 'Icon' in actionSpec ? actionSpec.Icon : undefined;

  return (
    <FormatButtonDropdown tooltipLabel={label} Icon={Icon}>
      <DropdownMenuItem className="color-picker-dropdown-menu flex flex-col !bg-background p-0">
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
      </DropdownMenuItem>
    </FormatButtonDropdown>
  );
}

function FormatDateAndTimePickerButton() {
  const dateAndTimeAction = defaultActionSpec[Action.FormatDateTime];

  return (
    <FormatButtonPopover tooltipLabel={dateAndTimeAction.label} Icon={dateAndTimeAction.Icon}>
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
