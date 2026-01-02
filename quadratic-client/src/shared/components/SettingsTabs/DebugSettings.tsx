import { setDebugFlag } from '@/app/debugFlags/debugFlags';
import {
  debugFlagDescriptions,
  debugFlagGroups,
  type DebugFlagDescription,
  type DebugFlagKeys,
} from '@/app/debugFlags/debugFlagsDefinitions';
import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { Label } from '@/shared/shadcn/ui/label';
import { Separator } from '@/shared/shadcn/ui/separator';
import { Switch } from '@/shared/shadcn/ui/switch';
import { useState } from 'react';

export function DebugSettings() {
  const { debugFlags } = useDebugFlags();

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(
    Object.fromEntries(debugFlagGroups.map((group) => [group, true]))
  );

  if (!debugFlags.debugAvailable) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <p className="text-sm font-normal text-muted-foreground">
            This menu is always available in development (DEBUG=1 in quadratic-client/.env). In production or PR
            previews, debug flags are only available by adding{' '}
            <span className="rounded bg-muted px-1 font-mono">?debug</span> to the url.
          </p>
        </div>

        <div className="space-y-0">
          <div className="py-3">
            <Setting
              keyName="debug"
              debug={debugFlagDescriptions.debug}
              value={debugFlags.getFlag('debug')}
              onChange={(newValue) => setDebugFlag('debug', newValue)}
            />
          </div>
          {debugFlags.getFlag('debug') &&
            debugFlagGroups.map((group, index) => {
              return (
                <div key={group}>
                  {index > 0 && <Separator />}
                  <div className="py-3">
                    <div
                      className="mb-2 flex cursor-pointer items-center gap-2 font-semibold"
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
                          ([key, value]) => value.group === group && debugFlags.getFlag(key as DebugFlagKeys)
                        ).length;
                        return count > 0 ? (
                          <span className="text-sm font-normal text-muted-foreground">({count})</span>
                        ) : null;
                      })()}
                    </div>
                    {!collapsed[group] && (
                      <div className="space-y-0">
                        {Object.entries(debugFlagDescriptions)
                          .filter(([_, value]) => value.group === group)
                          .map(([key, value], flagIndex, flags) => (
                            <div key={key}>
                              {flagIndex > 0 && <Separator />}
                              <div className="py-3">
                                <Setting
                                  keyName={key}
                                  debug={value}
                                  value={debugFlags.getFlag(key as DebugFlagKeys)}
                                  onChange={(newValue) => setDebugFlag(key as DebugFlagKeys, newValue)}
                                  disabled={key !== 'debug' && !debugFlags.getFlag('debug')}
                                />
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

interface SettingProps {
  keyName: string;
  value: boolean;
  debug: DebugFlagDescription;
  onChange: (newValue: boolean) => void;
  disabled?: boolean;
}

function Setting({ keyName, value, debug, onChange, disabled }: SettingProps) {
  if (disabled) {
    return null;
  }
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-1">
        <Label htmlFor={`debug-${keyName}`} className="cursor-pointer text-sm font-medium">
          {debug.title}
        </Label>
        {debug.description && (
          <div className="text-xs text-muted-foreground">
            {debug.description}
            <span className="text-xs text-muted-foreground/50"> ({keyName})</span>
          </div>
        )}
        {debug.restart && <div className="text-xs text-yellow-600">Restart Required</div>}
      </div>
      <Switch id={`debug-${keyName}`} checked={value} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
