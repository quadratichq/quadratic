import { focusGrid } from '@/app/helpers/focusGrid';
import { SidebarToggle, SidebarTooltip } from '@/app/ui/QuadraticSidebar';
import { ThemeIcon } from '@/shared/components/Icons';
import { ThemeAccentColors } from '@/shared/components/ThemeAccentColors';
import { ThemeAppearanceModes } from '@/shared/components/ThemeAppearanceModes';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/shadcn/ui/popover';
import { useState } from 'react';

export const ThemePickerMenu = () => {
  const [showThemeMenu, setShowThemeMenu] = useState(false);

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

        <h3 className="mb-1 text-xs font-semibold">Accent color</h3>
        <div className="grid grid-cols-3 gap-2">
          <ThemeAccentColors />
        </div>

        <h3 className="mb-1 mt-4 text-xs font-semibold">Appearance</h3>

        <div className="grid grid-cols-3 gap-2">
          <ThemeAppearanceModes />
        </div>
      </PopoverContent>
    </Popover>
  );
};
