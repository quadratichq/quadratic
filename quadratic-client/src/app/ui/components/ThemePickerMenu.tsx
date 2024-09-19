import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { SidebarToggle, SidebarTooltip } from '@/app/ui/QuadraticSidebar';
import { CheckSmallIcon } from '@/shared/components/Icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { useEffect, useState } from 'react';

const themeIds = ['blue', 'violet', 'orange', 'green', 'rose', 'black'] as const;
type ThemeId = (typeof themeIds)[number];

export const ThemePickerMenu = () => {
  // TODO: what about embedable view? should we show the file menu?

  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [activeThemeId, setActiveThemeId] = useState<ThemeId>('blue');

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

  return (
    <DropdownMenu defaultOpen={true}>
      <SidebarTooltip label="Theme color">
        <DropdownMenuTrigger asChild>
          <SidebarToggle
            pressed={showThemeMenu}
            onPressedChange={() => setShowThemeMenu(!showThemeMenu)}
            className="relative before:absolute before:left-2 before:top-2 before:h-4 before:w-4 before:rounded-full before:border-2 before:border-primary before:bg-primary before:content-['']"
          >
            <CheckSmallIcon className="relative text-background" />
          </SidebarToggle>
        </DropdownMenuTrigger>
      </SidebarTooltip>

      <DropdownMenuContent side="right" align="end">
        {themeIds.map((themeId) => (
          <DropdownMenuItem key={themeId} onClick={() => setActiveThemeId(themeId)}>
            <span data-theme={themeId} className="mr-2 inline-block h-4 w-4 rounded-full bg-primary">
              {themeId === activeThemeId && <CheckSmallIcon className="relative -left-0.5 -top-0.5 text-background" />}
            </span>
            <span className="capitalize">{themeId}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

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
