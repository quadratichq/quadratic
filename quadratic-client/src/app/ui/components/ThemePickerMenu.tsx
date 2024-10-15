import { focusGrid } from '@/app/helpers/focusGrid';
import { SidebarToggle, SidebarTooltip } from '@/app/ui/QuadraticSidebar';
import { featureFlagState } from '@/shared/atoms/featureFlags';
import { themeAccentColorAtom } from '@/shared/atoms/themeAccentColor';
import { ThemeIcon } from '@/shared/components/Icons';
import { ThemeAccentColors } from '@/shared/components/ThemeAccentColors';
import { ThemeAppearanceModes } from '@/shared/components/ThemeAppearanceModes';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/shadcn/ui/popover';
import { useState } from 'react';
import { useRecoilValue } from 'recoil';

export const ThemePickerMenu = () => {
  const featureFlags = useRecoilValue(featureFlagState);
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  // Have to put this here to initialize the effect so the app themes correctly
  // when it first loads, as the others are hidden behind a popover
  useRecoilValue(themeAccentColorAtom);

  if (!(featureFlags.themeAccentColor || featureFlags.themeAppearanceMode)) {
    return null;
  }

  return (
    <Popover open={showThemeMenu} onOpenChange={setShowThemeMenu}>
      <SidebarTooltip label="Theme">
        <PopoverTrigger asChild>
          <SidebarToggle pressed={showThemeMenu} onPressedChange={() => setShowThemeMenu(!showThemeMenu)}>
            <ThemeIcon />
          </SidebarToggle>
        </PopoverTrigger>
      </SidebarTooltip>

      <PopoverContent
        side="right"
        align="end"
        className="w-80"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          focusGrid();
        }}
      >
        <h2 className="text-md font-semibold">Theme customization</h2>
        <p className="mb-4 text-xs text-muted-foreground">Pick a style that fits you</p>

        {featureFlags.themeAccentColor && (
          <>
            <h3 className="mb-1 text-xs font-semibold">Accent color</h3>
            <div className="grid grid-cols-3 gap-2">
              <ThemeAccentColors />
            </div>
          </>
        )}
        {featureFlags.themeAppearanceMode && (
          <>
            <h3 className="mb-1 mt-4 text-xs font-semibold">Appearance</h3>

            <div className="grid grid-cols-3 gap-2">
              <ThemeAppearanceModes />
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};
