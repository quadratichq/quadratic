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
          className={cn('w-fit min-w-fit px-4 hover:bg-background', className)}
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

const ICON_OPACITY = 0.5;

const FormatColorTextIcon = memo(({ color }: { color: string | undefined }) => {
  return (
    <div className="group flex h-5 w-5 items-center">
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
          className="transition-opacity group-hover:opacity-100"
          d="M2,20M5.49,17h2.42l1.27-3.58h5.65L16.09,17h2.42L13.25,3h-2.5L5.49,17z M9.91,11.39l2.03-5.79h0.12l2.03,5.79 H9.91z"
        />
        <path
          fill={color}
          opacity={color === undefined ? ICON_OPACITY : 1}
          className="transition-opacity group-hover:opacity-100"
          d="M2,20h20v4H2V20z"
        />
      </svg>
    </div>
  );
});

const FormatColorFillIcon = memo(({ color }: { color: string | undefined }) => {
  return (
    <div className="group flex h-5 w-5 items-center">
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
            className="transition-opacity group-hover:opacity-100"
            d="M16.56,8.94L7.62,0L6.21,1.41l2.38,2.38L3.44,8.94c-0.59,0.59-0.59,1.54,0,2.12l5.5,5.5C9.23,16.85,9.62,17,10,17 s0.77-0.15,1.06-0.44l5.5-5.5C17.15,10.48,17.15,9.53,16.56,8.94z M5.21,10L10,5.21L14.79,10H5.21z M19,11.5c0,0-2,2.17-2,3.5 c0,1.1,0.9,2,2,2s2-0.9,2-2C21,13.67,19,11.5,19,11.5z"
          />
          <path fill={color} opacity={color === undefined ? ICON_OPACITY : 1} d="M2,20h20v4H2V20z" />
        </g>
      </svg>
    </div>
  );
});

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
    const IconNode =
      action === Action.FormatTextColor ? (
        <FormatColorTextIcon color={activeColor} />
      ) : (
        <FormatColorFillIcon color={activeColor} />
      );

    return (
      <FormatButtonDropdown
        tooltipLabel={label}
        IconNode={IconNode}
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
