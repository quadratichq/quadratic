import { Action } from '@/app/actions/actions';
import type { ActionArgs } from '@/app/actions/actionsSpec';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { events } from '@/app/events/events';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { inlineEditorMonaco } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorMonaco';
import { focusGrid } from '@/app/helpers/focusGrid';
import { keyboardShortcutEnumToDisplay } from '@/app/helpers/keyboardShortcutsDisplay';
import { ColorPicker } from '@/app/ui/components/ColorPicker';
import { DateFormat } from '@/app/ui/components/DateFormat';
import { shouldKeepInlineEditorFocus, textFormatSetCurrency } from '@/app/ui/helpers/formatCells';
import { useDefaultCurrency } from '@/app/ui/hooks/useDefaultCurrency';
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
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { memo, useCallback, useEffect, useRef, useState, type JSX, type ReactNode } from 'react';

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
    open,
    onOpenChange,
  }: {
    action: string;
    Icon?: React.ComponentType<any> | null;
    IconNode?: JSX.Element | null;
    children: ReactNode;
    tooltipLabel: string;

    className?: string;
    checked?: boolean;
    hideLabel?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => {
    return (
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
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
          className={cn('pointer-up-ignore w-fit min-w-fit px-4 hover:bg-background', className)}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            // Refocus inline editor if it's open, otherwise focus grid
            if (inlineEditorHandler.isOpen()) {
              shouldKeepInlineEditorFocus();
              setTimeout(() => inlineEditorMonaco.focus(), 0);
            } else if (!shouldKeepInlineEditorFocus()) {
              focusGrid();
            }
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
          className={cn('pointer-up-ignore w-fit p-1', className)}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            // Refocus inline editor if it's open, otherwise focus grid
            if (inlineEditorHandler.isOpen()) {
              shouldKeepInlineEditorFocus();
              setTimeout(() => inlineEditorMonaco.focus(), 0);
            } else if (!shouldKeepInlineEditorFocus()) {
              focusGrid();
            }
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
    isChecked,
  }: {
    actions: T[];
    actionArgs: T extends keyof ActionArgs ? ActionArgs[T] : void;
    hideLabel?: boolean;
    isChecked?: (action: T) => boolean;
  }) => {
    return actions.map((action, key) => {
      const actionSpec = defaultActionSpec[action];
      const label = hideLabel ? '' : actionSpec.label();
      const Icon = 'Icon' in actionSpec ? actionSpec.Icon : undefined;
      const checked = isChecked ? isChecked(action) : false;
      return (
        <DropdownMenuItem
          key={key}
          onClick={() => {
            trackEvent('[FormattingBar].button', { label });
            actionSpec.run(actionArgs);
          }}
          aria-label={hideLabel ? '' : label}
          data-testid={hideLabel ? '' : action}
          className={cn('py-1.5', checked && 'bg-accent/70')}
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
    enableHoldToRepeat = false,
    disabled = false,
  }: {
    action: T;
    actionArgs: T extends keyof ActionArgs ? ActionArgs[T] : void;
    checked?: boolean | null;
    hideLabel?: boolean;
    enableHoldToRepeat?: boolean;
    disabled?: boolean;
  }) => {
    const actionSpec = defaultActionSpec[action];
    const label = actionSpec.label();
    const Icon = 'Icon' in actionSpec ? actionSpec.Icon : undefined;
    const keyboardShortcut = keyboardShortcutEnumToDisplay(action);
    const intervalRef = useRef<number | null>(null);
    const timeoutRef = useRef<number | null>(null);
    const [keyboardPressed, setKeyboardPressed] = useState(false);

    // Listen for keyboard shortcut events to show visual feedback
    useEffect(() => {
      const handleKeyboardPress = (triggeredAction: string) => {
        if (triggeredAction === action) {
          setKeyboardPressed(true);
          setTimeout(() => setKeyboardPressed(false), 150);
        }
      };

      events.on('formatButtonKeyboard', handleKeyboardPress);
      return () => {
        events.off('formatButtonKeyboard', handleKeyboardPress);
      };
    }, [action]);

    const executeAction = useCallback(() => {
      trackEvent('[FormattingBar].button', { label });
      actionSpec.run(actionArgs);
    }, [actionSpec, actionArgs, label]);

    const clearTimers = useCallback(() => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }, []);

    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        if (!enableHoldToRepeat) return;

        e.preventDefault();
        // Execute once immediately
        executeAction();

        // Start repeating after a delay
        timeoutRef.current = window.setTimeout(() => {
          intervalRef.current = window.setInterval(() => {
            executeAction();
          }, 100); // Repeat every 100ms
        }, 300); // Initial delay of 300ms
      },
      [enableHoldToRepeat, executeAction]
    );

    const handleMouseUp = useCallback(() => {
      if (!enableHoldToRepeat) return;
      clearTimers();
      // Refocus inline editor if it's open, otherwise focus grid
      if (inlineEditorHandler.isOpen()) {
        // Clear the flag if it was set (for span formatting)
        shouldKeepInlineEditorFocus();
        setTimeout(() => inlineEditorMonaco.focus(), 0);
      } else if (!shouldKeepInlineEditorFocus()) {
        focusGrid();
      }
    }, [enableHoldToRepeat, clearTimers]);

    const handleMouseLeave = useCallback(() => {
      if (!enableHoldToRepeat) return;
      clearTimers();
    }, [enableHoldToRepeat, clearTimers]);

    const handleClick = useCallback(() => {
      if (!enableHoldToRepeat) {
        executeAction();
        // Refocus inline editor if it's open, otherwise focus grid
        if (inlineEditorHandler.isOpen()) {
          // Clear the flag if it was set (for span formatting)
          shouldKeepInlineEditorFocus();
          setTimeout(() => inlineEditorMonaco.focus(), 0);
        } else if (!shouldKeepInlineEditorFocus()) {
          focusGrid();
        }
      }
    }, [enableHoldToRepeat, executeAction]);

    if (!Icon) return null;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={hideLabel ? '' : label}
            variant="ghost"
            size="icon-sm"
            className={cn(
              'flex items-center text-muted-foreground hover:bg-accent hover:text-foreground focus:bg-accent focus:text-foreground focus:outline-none',
              checked || keyboardPressed ? 'bg-accent' : ''
            )}
            onClick={handleClick}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            data-testid={hideLabel ? '' : action}
            disabled={disabled}
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
    const [open, setOpen] = useState(false);
    const actionSpec = defaultActionSpec[action];
    const label = actionSpec.label();
    const Icon = actionSpec.Icon;

    const iconNode = Icon ? (
      <div className="relative flex items-center justify-center">
        <Icon />
        <div
          className="absolute bottom-0 left-0.5 right-0.5 h-1 rounded-sm"
          style={{ backgroundColor: activeColor ?? 'currentColor' }}
        />
      </div>
    ) : null;

    return (
      <FormatButtonDropdown
        tooltipLabel={label}
        IconNode={iconNode}
        checked={activeColor !== undefined}
        hideLabel={hideLabel}
        action={action}
        open={open}
        onOpenChange={setOpen}
      >
        <DropdownMenuItem
          className="color-picker-dropdown-menu flex flex-col !bg-background p-0"
          onSelect={(e) => e.preventDefault()}
        >
          <ColorPicker
            color={activeColor}
            onChangeComplete={(color) => {
              actionSpec.run(color);
              // Refocus inline editor if it's open, otherwise focus grid
              if (inlineEditorHandler.isOpen()) {
                shouldKeepInlineEditorFocus();
                setTimeout(() => inlineEditorMonaco.focus(), 0);
              } else if (!shouldKeepInlineEditorFocus()) {
                focusGrid();
              }
            }}
            onClear={() => {
              actionSpec.run(undefined);
              // Refocus inline editor if it's open, otherwise focus grid
              if (inlineEditorHandler.isOpen()) {
                shouldKeepInlineEditorFocus();
                setTimeout(() => inlineEditorMonaco.focus(), 0);
              } else if (!shouldKeepInlineEditorFocus()) {
                focusGrid();
              }
            }}
            onClose={() => setOpen(false)}
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
            // Refocus inline editor if it's open, otherwise focus grid
            if (inlineEditorHandler.isOpen()) {
              setTimeout(() => inlineEditorMonaco.focus(), 0);
            } else {
              focusGrid();
            }
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

type CurrencyOption = {
  symbol: string;
  label: string;
};

const CURRENCY_OPTIONS: CurrencyOption[] = [
  { symbol: '$', label: '$ (Dollars)' },
  { symbol: '€', label: '€ (Euros)' },
  { symbol: '£', label: '£ (Pounds)' },
  { symbol: '¥', label: '¥ (Yuan)' },
  { symbol: 'CHF', label: 'CHF (Swiss Francs)' },
  { symbol: '₹', label: '₹ (Indian Rupees)' },
  { symbol: 'R$', label: 'R$ (Brazilian Reais)' },
  { symbol: '₩', label: '₩ (South Korean Won)' },
  { symbol: 'zł', label: 'zł (Polish Zloty)' },
  { symbol: '₺', label: '₺ (Turkish Lira)' },
  { symbol: '₽', label: '₽ (Russian Rubles)' },
  { symbol: 'R', label: 'R (South African Rand)' },
  { symbol: 'kr', label: 'kr (Norwegian Kroner)' },
];

export const FormatCurrencyButton = memo(
  ({
    formatSummary,
    hideLabel,
  }: {
    formatSummary: { numericFormat: { type: string; symbol: string | null } | null } | undefined;
    hideLabel?: boolean;
  }) => {
    const [defaultCurrency, setDefaultCurrency] = useDefaultCurrency();
    const isCurrency = formatSummary?.numericFormat?.type === 'CURRENCY';
    const currentSymbol = formatSummary?.numericFormat?.symbol || defaultCurrency;
    const displaySymbol = isCurrency ? currentSymbol : defaultCurrency;

    return (
      <DropdownMenu>
        <div className="flex items-center gap-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={hideLabel ? '' : 'Currency'}
                variant="ghost"
                className={cn(
                  'flex h-7 w-auto min-w-[1.5rem] items-center justify-center whitespace-nowrap rounded-l rounded-r-none px-1 text-muted-foreground hover:bg-accent hover:text-foreground focus:bg-accent focus:text-foreground focus:outline-none',
                  isCurrency ? 'bg-accent' : ''
                )}
                onClick={() => {
                  trackEvent('[FormattingBar].button', { label: 'Currency' });
                  textFormatSetCurrency(defaultCurrency);
                  // Refocus inline editor if it's open, otherwise focus grid
                  if (inlineEditorHandler.isOpen()) {
                    setTimeout(() => inlineEditorMonaco.focus(), 0);
                  } else {
                    focusGrid();
                  }
                }}
                data-testid={hideLabel ? '' : 'format_number_currency'}
              >
                <span className="text-sm font-medium">{displaySymbol}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <TooltipContents label={hideLabel ? '' : 'Currency'} />
            </TooltipContent>
          </Tooltip>
          <DropdownMenuTrigger
            aria-label={hideLabel ? '' : 'Currency options'}
            className={cn(
              'flex h-7 w-[10px] items-center justify-center rounded-l-none rounded-r text-muted-foreground hover:bg-accent hover:text-foreground focus:bg-accent focus:text-foreground focus:outline-none aria-expanded:bg-accent aria-expanded:text-foreground',
              isCurrency ? 'bg-accent' : ''
            )}
            data-testid={hideLabel ? '' : 'format_number_currency_dropdown'}
          >
            <ArrowDropDownIcon className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
        </div>
        <DropdownMenuContent
          className="pointer-up-ignore hover:bg-background"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            // Refocus inline editor if it's open, otherwise focus grid
            if (inlineEditorHandler.isOpen()) {
              setTimeout(() => inlineEditorMonaco.focus(), 0);
            } else {
              focusGrid();
            }
          }}
        >
          {CURRENCY_OPTIONS.map((option) => {
            const isSelected = isCurrency && currentSymbol === option.symbol;
            return (
              <DropdownMenuItem
                key={option.symbol}
                onClick={() => {
                  trackEvent('[FormattingBar].button', { label: `Currency: ${option.symbol}` });
                  textFormatSetCurrency(option.symbol);
                  setDefaultCurrency(option.symbol);
                  // Refocus inline editor if it's open, otherwise focus grid
                  if (inlineEditorHandler.isOpen()) {
                    setTimeout(() => inlineEditorMonaco.focus(), 0);
                  } else {
                    focusGrid();
                  }
                }}
                aria-label={hideLabel ? '' : option.label}
                data-testid={hideLabel ? '' : `currency_${option.symbol}`}
                className={cn(isSelected && 'bg-accent')}
              >
                <span>{option.label}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
);
