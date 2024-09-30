import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { SidebarToggle, SidebarTooltip } from '@/app/ui/QuadraticSidebar';
import {
  AppearanceDarkModeIcon,
  AppearanceLightModeIcon,
  AppearanceSystemModeIcon,
  CheckSmallIcon,
  ThemeIcon,
} from '@/shared/components/Icons';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { useTheme } from '@/shared/hooks/useTheme';
import { Button } from '@/shared/shadcn/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/shadcn/ui/popover';
import { cn } from '@/shared/shadcn/utils';
import { useEffect, useState } from 'react';

const themeIds = ['blue', 'violet', 'orange', 'green', 'rose', 'black'] as const;
type ThemeId = (typeof themeIds)[number];

const useAccentColor = () => {
  const [activeThemeId, setActiveThemeId] = useLocalStorage<ThemeId>('accentColor', 'blue');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeThemeId);
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary');

    // const primaryColor = themeVars.primary;
    const [h, s, l] = primaryColor.split(' ').map((val) => Number(val.replace('%', '')));
    const hex = hslToHex(h, s, l).replace('#', '');
    pixiApp.setAccentColor(hex);
    console.log('primaryColor', primaryColor);
    console.log('hsl', h, s, l);
    console.log('hex', hex);
  }, [activeThemeId]);

  return { activeThemeId, setActiveThemeId };
};

export const ThemePickerMenu = () => {
  // TODO: what about embedable view? should we show the file menu?

  const [showThemeMenu, setShowThemeMenu] = useState(false);

  return (
    <Popover defaultOpen={true}>
      <SidebarTooltip label="Theme color">
        <PopoverTrigger asChild>
          <SidebarToggle
            pressed={showThemeMenu}
            onPressedChange={() => setShowThemeMenu(!showThemeMenu)}
            // className="relative before:absolute before:left-2 before:top-2 before:h-4 before:w-4 before:rounded-full before:border-2 before:border-primary before:bg-primary before:content-['']"
          >
            <ThemeIcon className="text-primary" />
          </SidebarToggle>
        </PopoverTrigger>
      </SidebarTooltip>

      <PopoverContent side="right" align="end" className="w-80">
        <h2 className="text-md font-semibold">App customization</h2>
        <p className="mb-4 text-xs text-muted-foreground">Pick a style you like</p>

        <h3 className="mb-1 text-xs font-semibold">Accent color</h3>
        <div className="grid grid-cols-3 gap-2">
          <AccentColorPicker />
        </div>

        <h3 className="mb-1 mt-4 text-xs font-semibold">Appearance</h3>

        <div className="grid grid-cols-3 gap-2">
          <AppearancePicker />
        </div>

        <h3 className="mb-1 mt-4 text-xs font-semibold">Corners</h3>
        <div className="grid grid-cols-3 gap-2">
          {['square', 'soft', 'rounded'].map((item) => (
            <Button
              size="sm"
              variant="outline"
              className="capitalize"
              onClick={() => {
                if (item === 'square') {
                  document.documentElement.style.setProperty('--radius', '0rem');
                } else if (item === 'soft') {
                  document.documentElement.style.setProperty('--radius', '0.5rem');
                } else if (item === 'rounded') {
                  document.documentElement.style.setProperty('--radius', '1rem');
                }
              }}
            >
              {item}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export function AppearancePicker() {
  const [theme, setTheme] = useTheme();
  return ['light', 'dark', 'system'].map((item) => (
    <Button
      size="sm"
      variant="outline"
      className={cn(item === theme && 'border-2 border-foreground', 'justify-start gap-1 capitalize')}
      // @ts-expect-error
      onClick={() => setTheme(item)}
    >
      {item === 'light' ? (
        <AppearanceLightModeIcon />
      ) : item === 'dark' ? (
        <AppearanceDarkModeIcon />
      ) : (
        <AppearanceSystemModeIcon />
      )}
      {item}
    </Button>
  ));
}

export function AccentColorPicker() {
  const { activeThemeId, setActiveThemeId } = useAccentColor();
  return themeIds.map((themeId) => (
    <Button
      size="sm"
      variant="outline"
      key={themeId}
      onClick={() => setActiveThemeId(themeId)}
      className={cn(themeId === activeThemeId && 'border-2 border-foreground', 'justify-start')}
    >
      <span data-theme={themeId} className="-ml-1 mr-2 flex h-4 w-4 shrink-0 rounded-full bg-primary">
        {themeId === activeThemeId && <CheckSmallIcon className="relative -left-0.5 -top-0.5 text-background" />}
      </span>
      <span className="capitalize">{themeId}</span>
    </Button>
  ));
}

function hslToHex(h: number, s: number, l: number) {
  // Normalize the saturation and lightness values
  s /= 100;
  l /= 100;

  // Calculate the chroma (C)
  const c = (1 - Math.abs(2 * l - 1)) * s;

  // Calculate the intermediate value (X)
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));

  // Calculate the lightness match (m)
  const m = l - c / 2;

  let r = 0,
    g = 0,
    b = 0;

  if (0 <= h && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (60 <= h && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (120 <= h && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (180 <= h && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (240 <= h && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (300 <= h && h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  // Convert RGB values to [0, 255] range and add the match (m)
  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  // Convert RGB to HEX
  const toHex = (value: number) => value.toString(16).padStart(2, '0');

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
