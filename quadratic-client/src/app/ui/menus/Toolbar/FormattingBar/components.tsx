import { Action } from '@/app/actions/actions';
import type { ActionArgs } from '@/app/actions/actionsSpec';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { focusGrid } from '@/app/helpers/focusGrid';
import { keyboardShortcutEnumToDisplay } from '@/app/helpers/keyboardShortcutsDisplay';
import { DateFormat } from '@/app/ui/components/DateFormat';
import { QColorPicker } from '@/app/ui/components/qColorPicker';
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
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { memo, type JSX, type ReactNode } from 'react';

export const FormatSeparator = memo(() => {
  return <hr className="relative mx-1.5 h-6 w-[1px] bg-border" />;
});

export const FormatButtonDropdown = memo(
  ({
    action,
    Icon,
    IconNode,
    tooltipLabel,
    children,

    className,
    checked,
    hideLabel,
  }: {
    action: string;
    Icon?: React.ComponentType<any> | null;
    IconNode?: JSX.Element | null;
    children: ReactNode;
    tooltipLabel: string;

    className?: string;
    checked?: boolean;
    hideLabel?: boolean;
  }) => {
    return (
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger
              aria-label={hideLabel ? '' : tooltipLabel}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus:bg-accent focus:text-foreground focus:outline-none aria-expanded:bg-accent aria-expanded:text-foreground',
                checked ? 'bg-accent' : ''
              )}
              data-testid={hideLabel ? '' : action}
            >
              {Icon ? <Icon /> : (IconNode ?? null)}
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <TooltipContents label={hideLabel ? '' : tooltipLabel} />
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent
          className={cn('hover:bg-background', className)}
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
);

export const FormatButtonPopover = memo(
  ({
    action,
    Icon,
    tooltipLabel,
    children,

    className,
    hideLabel,
  }: {
    action: string;
    Icon: any;
    children: ReactNode;
    tooltipLabel: string;

    className?: string;
    hideLabel?: boolean;
  }) => {
    return (
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger
              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus:bg-accent focus:text-foreground focus:outline-none aria-expanded:bg-accent aria-expanded:text-foreground"
              aria-label={hideLabel ? '' : tooltipLabel}
              data-testid={hideLabel ? '' : action}
            >
              <Icon />
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <TooltipContents label={hideLabel ? '' : tooltipLabel} />
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
);

export const FormatButtonDropdownActions = memo(
  <T extends Action>({
    actions,
    actionArgs,
    hideLabel,
  }: {
    actions: T[];
    actionArgs: T extends keyof ActionArgs ? ActionArgs[T] : void;
    hideLabel?: boolean;
  }) => {
    return actions.map((action, key) => {
      const actionSpec = defaultActionSpec[action];
      const label = hideLabel ? '' : actionSpec.label();
      const Icon = 'Icon' in actionSpec ? actionSpec.Icon : undefined;
      return (
        <DropdownMenuItem
          key={key}
          onClick={() => {
            trackEvent('[FormattingBar].button', { label });
            actionSpec.run(actionArgs);
          }}
          aria-label={hideLabel ? '' : label}
          data-testid={hideLabel ? '' : action}
        >
          {Icon && <Icon className="mr-2" />}
          {label}
        </DropdownMenuItem>
      );
    });
  }
);

export const FormatButton = memo(
  <T extends Action>({
    action,
    actionArgs,
    checked,
    hideLabel,
  }: {
    action: T;
    actionArgs: T extends keyof ActionArgs ? ActionArgs[T] : void;
    checked?: boolean | null;
    hideLabel?: boolean;
  }) => {
    const actionSpec = defaultActionSpec[action];
    const label = actionSpec.label();
    const Icon = 'Icon' in actionSpec ? actionSpec.Icon : undefined;
    if (!Icon) return null;
    const keyboardShortcut = keyboardShortcutEnumToDisplay(action);
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={hideLabel ? '' : label}
            variant="ghost"
            size="icon-sm"
            className={cn(
              'flex items-center text-muted-foreground hover:bg-accent hover:text-foreground focus:bg-accent focus:text-foreground focus:outline-none',
              checked ? 'bg-accent' : ''
            )}
            onClick={() => {
              trackEvent('[FormattingBar].button', { label });
              actionSpec.run(actionArgs);
              focusGrid();
            }}
            data-testid={hideLabel ? '' : action}
          >
            <Icon />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <TooltipContents label={hideLabel ? '' : label} keyboardShortcut={keyboardShortcut} />
        </TooltipContent>
      </Tooltip>
    );
  }
);

export const FormatColorPickerButton = memo(
  ({
    action,
    activeColor,
    hideLabel,
  }: {
    action: Action.FormatTextColor | Action.FormatFillColor;
    activeColor?: string;
    hideLabel?: boolean;
  }) => {
    const actionSpec = defaultActionSpec[action];
    const label = actionSpec.label();
    const Icon = actionSpec.Icon;

    return (
      <FormatButtonDropdown
        tooltipLabel={label}
        IconNode={Icon && <Icon style={activeColor ? { color: activeColor } : undefined} />}
        checked={activeColor !== undefined}
        hideLabel={hideLabel}
        action={action}
      >
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
);

export const FormatDateAndTimePickerButton = memo(({ hideLabel }: { hideLabel?: boolean }) => {
  const dateAndTimeAction = defaultActionSpec[Action.FormatDateTime];
  const label = dateAndTimeAction.label();

  return (
    <FormatButtonPopover
      tooltipLabel={label}
      Icon={dateAndTimeAction.Icon}
      hideLabel={hideLabel}
      action={Action.FormatDateTime}
    >
      <div className="min-w-80 p-2">
        <DateFormat
          closeMenu={() => {
            focusGrid();
          }}
        />
      </div>
    </FormatButtonPopover>
  );
});

export const TooltipContents = memo(({ label, keyboardShortcut }: { label: string; keyboardShortcut?: string }) => {
  return (
    <p>
      {label}{' '}
      {keyboardShortcut && (
        <span className="opacity-50 before:content-['('] after:content-[')']">{keyboardShortcut}</span>
      )}
    </p>
  );
});
