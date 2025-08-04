import { setDebugFlag } from '@/app/debugFlags/debugFlags';
import {
  debugFlagDescriptions,
  debugFlagGroups,
  type DebugFlagDescription,
} from '@/app/debugFlags/debugFlagsDefinitions';
import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { focusGrid } from '@/app/helpers/focusGrid';
import { Label } from '@/shared/shadcn/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/shared/shadcn/ui/sheet';
import { Switch } from '@/shared/shadcn/ui/switch';
import { cn } from '@/shared/shadcn/utils';
import { useEffect, useState } from 'react';

export const QuadraticAppDebugSettings = () => {
  const { debugFlags } = useDebugFlags();

  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(
    Object.fromEntries(debugFlagGroups.map((group) => [group, true]))
  );

  // Magic shortcut cmd+shift+option+i opens settings
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'KeyI' && event.shiftKey && event.altKey && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        event.stopPropagation();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      focusGrid();
    }
  }, [open]);

  if (!debugFlags.debugAvailable) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent showOverlay={false} className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Debugging flags</SheetTitle>
          <SheetDescription>
            This menu is always available in development (DEBUG=1 in quadratic-client/.env). In production or PR
            previews, debug flags are only available by adding{' '}
            <span className="rounded bg-muted px-1 font-mono">?debug</span> to the url.
          </SheetDescription>
        </SheetHeader>
        <div className="h-full w-full overflow-y-auto pt-2">
          <div key="debug">
            <Setting
              keyName="debug"
              debug={debugFlagDescriptions.debug}
              value={debugFlags.getFlag('debug')}
              onChange={(newValue) => setDebugFlag('debug', newValue)}
            />
          </div>
          {debugFlags.getFlag('debug') &&
            debugFlagGroups.map((group) => {
              return (
                <div key={group} className="mb-4">
                  <div
                    className="flex cursor-pointer items-center gap-2 font-bold"
                    onClick={() => setCollapsed((prev) => ({ ...prev, [group]: !prev[group] }))}
                  >
                    <div
                      className="rotate-90 transition-transform"
                      style={{ transform: collapsed[group] ? 'rotate(0deg)' : 'rotate(90deg)' }}
                    >
                      ▶
                    </div>
                    {group}
                    {(() => {
                      const count = Object.entries(debugFlagDescriptions).filter(
                        ([key, value]) => value.group === group && debugFlags.getFlag(key)
                      ).length;
                      return count > 0 ? (
                        <span className="text-sm font-normal text-muted-foreground">({count})</span>
                      ) : null;
                    })()}
                  </div>
                  {!collapsed[group] && (
                    <>
                      {Object.entries(debugFlagDescriptions)
                        .filter(([_, value]) => value.group === group)
                        .map(([key, value]) => (
                          <Setting
                            className={key === 'debug' ? '-mx-3 mb-1 rounded bg-accent px-3 py-3' : ''}
                            keyName={key}
                            debug={value}
                            value={debugFlags.getFlag(key)}
                            onChange={(newValue) => setDebugFlag(key, newValue)}
                            key={key}
                            disabled={key !== 'debug' && !debugFlags.getFlag('debug')}
                          />
                        ))}
                    </>
                  )}
                </div>
              );
            })}
        </div>
      </SheetContent>
    </Sheet>
  );
};

function Setting({
  className,
  keyName,
  value,
  debug,
  onChange,
  disabled,
}: {
  className?: string;
  value: boolean;
  keyName: string;
  debug: DebugFlagDescription;
  onChange: (newValue: boolean) => void;
  disabled?: boolean;
}) {
  if (disabled) {
    return null;
  }
  return (
    <Label className={cn(`flex items-center gap-2 px-2 py-3`, className)}>
      <div className="flex flex-col gap-1">
        <div className="text-sm font-medium">{debug.title}</div>
        {debug.description && (
          <div className="text-xs text-muted-foreground">
            {debug.description}
            <span className="text-xs text-muted-foreground/50"> ({keyName})</span>
          </div>
        )}
        {debug.restart && <div className="text-xs text-yellow-600">Restart Required</div>}
      </div>
      <Switch checked={value} onCheckedChange={onChange} className="ml-auto" disabled={disabled} />{' '}
    </Label>
  );
}
