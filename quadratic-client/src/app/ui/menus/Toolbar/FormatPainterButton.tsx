import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { formatPainterAtom } from '@/app/atoms/formatPainterAtom';
import { events } from '@/app/events/events';
import { keyboardShortcutEnumToDisplay } from '@/app/helpers/keyboardShortcutsDisplay';
import { Button } from '@/shared/shadcn/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { useAtomValue } from 'jotai';
import { memo, useEffect, useState } from 'react';

export const FormatPainterButton = memo(() => {
  const formatPainter = useAtomValue(formatPainterAtom);
  const [keyboardPressed, setKeyboardPressed] = useState(false);

  const actionSpec = defaultActionSpec[Action.FormatPainter];
  const label = actionSpec.label();
  const Icon = 'Icon' in actionSpec ? actionSpec.Icon : undefined;
  const keyboardShortcut = keyboardShortcutEnumToDisplay(Action.FormatPainter);

  // Listen for keyboard shortcut events to show visual feedback
  useEffect(() => {
    const handleKeyboardPress = (triggeredAction: string) => {
      if (triggeredAction === Action.FormatPainter) {
        setKeyboardPressed(true);
        setTimeout(() => setKeyboardPressed(false), 150);
      }
    };

    events.on('formatButtonKeyboard', handleKeyboardPress);
    return () => {
      events.off('formatButtonKeyboard', handleKeyboardPress);
    };
  }, []);

  const handleClick = () => {
    actionSpec.run();
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          variant="ghost"
          size="icon-sm"
          className={cn(
            'ml-0 mr-1.5 flex items-center text-muted-foreground hover:bg-accent hover:text-foreground focus:bg-accent focus:text-foreground focus:outline-none',
            (formatPainter.active || keyboardPressed) && 'bg-accent text-foreground'
          )}
          onClick={handleClick}
          data-testid="format-painter"
        >
          {Icon && <Icon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <div className="flex items-center gap-2">
          <span>{label}</span>
          {keyboardShortcut && <span className="text-muted-foreground">{keyboardShortcut}</span>}
        </div>
        {formatPainter.active && (
          <div className="text-xs text-muted-foreground">Click to cancel, or select cells to apply</div>
        )}
      </TooltipContent>
    </Tooltip>
  );
});
