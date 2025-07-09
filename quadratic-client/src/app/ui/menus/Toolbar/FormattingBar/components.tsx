import { Action } from '@/app/actions/actions';
import type { ActionArgs } from '@/app/actions/actionsSpec';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { focusGrid } from '@/app/helpers/focusGrid';
import { keyboardShortcutEnumToDisplay } from '@/app/helpers/keyboardShortcutsDisplay';
import { DateFormat } from '@/app/ui/components/DateFormat';
import { QColorPicker } from '@/app/ui/components/qColorPicker';
import { ArrowDropDownIcon } from '@/shared/components/Icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/shadcn/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import mixpanel from 'mixpanel-browser';
import { ToggleGroup } from 'radix-ui';
import { type ReactNode } from 'react';

export function FormatSeparator() {
  return <hr className="relative mx-1.5 mt-1.5 h-2/3 w-[1px] bg-border" />;
}

export function FormatButtonDropdown({
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

export function FormatButtonPopover({
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

export function FormatButtonDropdownActions<T extends Action>({
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

export function FormatButton<T extends Action>({
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

export function FormatColorPickerButton({
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

export function FormatDateAndTimePickerButton() {
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
