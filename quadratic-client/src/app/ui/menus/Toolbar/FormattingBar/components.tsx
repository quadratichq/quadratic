import { Action } from '@/app/actions/actions';
import type { ActionArgs } from '@/app/actions/actionsSpec';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { focusGrid } from '@/app/helpers/focusGrid';
import { keyboardShortcutEnumToDisplay } from '@/app/helpers/keyboardShortcutsDisplay';
import { DateFormat } from '@/app/ui/components/DateFormat';
import { QColorPicker } from '@/app/ui/components/qColorPicker';
import { ArrowDropDownIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
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
import { type JSX, type ReactNode } from 'react';

export function FormatSeparator() {
  return <hr className="relative mx-1.5 mt-1.5 h-2/3 w-[1px] bg-border" />;
}

export function FormatButtonDropdown({
  Icon,
  IconNode,
  tooltipLabel,
  children,
  showDropdownArrow,
  className,
}: {
  Icon?: React.ComponentType<any> | null;
  IconNode?: JSX.Element | null;
  children: ReactNode;
  tooltipLabel: string;
  showDropdownArrow?: boolean;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger className="flex h-full items-center px-2 text-muted-foreground hover:bg-accent hover:text-foreground focus:bg-accent focus:text-foreground focus:outline-none aria-expanded:bg-accent aria-expanded:text-foreground">
            {Icon ? <Icon /> : (IconNode ?? null)}
            {showDropdownArrow && <ArrowDropDownIcon className="-ml-1 -mr-2" />}
          </DropdownMenuTrigger>
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
          <PopoverTrigger className="flex h-full items-center px-2 text-muted-foreground hover:bg-accent hover:text-foreground focus:bg-accent focus:text-foreground focus:outline-none aria-expanded:bg-accent aria-expanded:text-foreground">
            <Icon />
            {showDropdownArrow && <ArrowDropDownIcon className="-ml-1 -mr-2" />}
          </PopoverTrigger>
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
  checked,
}: {
  action: T;
  actionArgs: T extends keyof ActionArgs ? ActionArgs[T] : void;
  checked?: boolean | null;
}) {
  const actionSpec = defaultActionSpec[action];
  const label = actionSpec.label();
  const Icon = 'Icon' in actionSpec ? actionSpec.Icon : undefined;
  if (!Icon) return null;
  const keyboardShortcut = keyboardShortcutEnumToDisplay(action);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          variant="ghost"
          size="sm"
          className={cn(
            'flex h-full items-center px-2 text-muted-foreground hover:bg-accent hover:text-foreground focus:bg-accent focus:text-foreground focus:outline-none',
            checked ? 'bg-accent' : ''
          )}
          onClick={() => {
            mixpanel.track('[FormattingBar].button', { label });
            actionSpec.run(actionArgs);
            focusGrid();
          }}
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <TooltipContents label={label} keyboardShortcut={keyboardShortcut} />
      </TooltipContent>
    </Tooltip>
  );
}

const ICON_OPACITY = 0.5;

const FormatColorTextIcon = ({ color }: { color: string | undefined }) => {
  return (
    <div style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center' }}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        enableBackground="new 0 0 24 24"
        height="24"
        viewBox="0 0 24 24"
        width="24"
      >
        <rect fill="none" height="24" width="24" />
        <path
          opacity={ICON_OPACITY}
          d="M2,20M5.49,17h2.42l1.27-3.58h5.65L16.09,17h2.42L13.25,3h-2.5L5.49,17z M9.91,11.39l2.03-5.79h0.12l2.03,5.79 H9.91z"
        />
        <path fill={color} opacity={color === undefined ? ICON_OPACITY : 1} d="M2,20h20v4H2V20z" />
      </svg>
    </div>
  );
};

const FormatColorFillIcon = ({ color }: { color: string | undefined }) => {
  return (
    <div style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center' }}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        enableBackground="new 0 0 24 24"
        height="24"
        viewBox="0 0 24 24"
        width="24"
      >
        <g>
          <rect fill="none" height="24" width="24" />
        </g>
        <g>
          <path
            opacity={ICON_OPACITY}
            d="M16.56,8.94L7.62,0L6.21,1.41l2.38,2.38L3.44,8.94c-0.59,0.59-0.59,1.54,0,2.12l5.5,5.5C9.23,16.85,9.62,17,10,17 s0.77-0.15,1.06-0.44l5.5-5.5C17.15,10.48,17.15,9.53,16.56,8.94z M5.21,10L10,5.21L14.79,10H5.21z M19,11.5c0,0-2,2.17-2,3.5 c0,1.1,0.9,2,2,2s2-0.9,2-2C21,13.67,19,11.5,19,11.5z"
          />
          <path fill={color} opacity={color === undefined ? ICON_OPACITY : 1} d="M2,20h20v4H2V20z" />
        </g>
      </svg>
    </div>
  );
};

export function FormatColorPickerButton({
  action,
  activeColor,
}: {
  action: Action.FormatTextColor | Action.FormatFillColor;
  activeColor?: string;
}) {
  const actionSpec = defaultActionSpec[action];
  const label = actionSpec.label();
  const IconNode =
    action === Action.FormatTextColor ? (
      <FormatColorTextIcon color={activeColor} />
    ) : (
      <FormatColorFillIcon color={activeColor} />
    );

  return (
    <FormatButtonDropdown tooltipLabel={label} IconNode={IconNode}>
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
