import * as debugFlags from '@/app/debugFlags';
import { focusGrid } from '@/app/helpers/focusGrid';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { Label } from '@/shared/shadcn/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/shadcn/ui/sheet';
import { Switch } from '@/shared/shadcn/ui/switch';
import { cn } from '@/shared/shadcn/utils';
import { useEffect, useState } from 'react';

// TODO: when you add a new debug flag in code, make sure it shows up in the UI
// TODO: rename component and possible exports

const initialDebugFlags = {
  debug: debugFlags.debug, // master override
  debugShowFPS: debugFlags.debugShowFPS,
  debugShowWhyRendering: debugFlags.debugShowWhyRendering,
  debugShowAIInternalContext: debugFlags.debugShowAIInternalContext,
} as const;

const STORAGE_KEY = 'debugSettings';

const normalize = (settings: Record<string, boolean>) => {
  if (settings.debug === false) {
    return Object.fromEntries(Object.keys(settings).map((key) => [key, false]));
  }
  return settings;
};

export const useDebugFlags = () => {
  const [settings, setSettings] = useLocalStorage(STORAGE_KEY, initialDebugFlags);
  return [normalize(settings), setSettings] as const;
};

export const debugFlag = (key: keyof typeof initialDebugFlags): boolean => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : initialDebugFlags;
    const normalized = normalize(parsed);
    return Boolean(normalized[key]);
  } catch {
    return false; // fallback safe default
  }
};

export const QuaraticAppDebugSettings = () => {
  const [open, setOpen] = useState(false);
  const [debugSettings, setDebugSettings] = useDebugFlags();

  // Magic shortcut cmd+shift+option+i opens settings
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'KeyI' && event.shiftKey && event.altKey && event.metaKey) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      focusGrid();
    }
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent showOverlay={false}>
        <SheetHeader>
          <SheetTitle>Debugging flags</SheetTitle>
        </SheetHeader>
        <div className="pt-2">
          {Object.entries(debugSettings).map(([key, value], i) => (
            <Setting
              className={key === 'debug' ? '-mx-3 mb-1 rounded bg-accent px-3 py-3' : ''}
              label={key}
              value={value}
              onChange={(newValue) => setDebugSettings((prev) => ({ ...prev, [key]: newValue }))}
              key={key}
              disabled={key !== 'debug' && !debugSettings.debug}
            />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};
function Setting({
  className,
  value,
  label,
  onChange,
  disabled,
}: {
  className?: string;
  value: boolean;
  label: string;
  onChange: (newValue: boolean) => void;
  disabled?: boolean;
}) {
  if (disabled) {
    return null;
  }
  return (
    <Label className={cn(`flex items-center gap-2 py-2`, className)}>
      {label}
      <Switch checked={value} onCheckedChange={onChange} className="ml-auto" disabled={disabled} />{' '}
    </Label>
  );
}
