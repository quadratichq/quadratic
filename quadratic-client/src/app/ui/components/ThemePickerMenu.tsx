import { SidebarToggle, SidebarTooltip } from '@/app/ui/QuadraticSidebar';
import { ThemeIcon } from '@/shared/components/Icons';
import { ThemeAccentColors } from '@/shared/components/ThemeAccentColors';
import { ThemeAppearanceModes } from '@/shared/components/ThemeAppearanceModes';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/shadcn/ui/popover';
import { useState } from 'react';

export const ThemePickerMenu = () => {
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  return (
    <Popover>
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

      <PopoverContent side="right" align="end" className="w-80" forceMount>
        <h2 className="text-md font-semibold">App customization</h2>
        <p className="mb-4 text-xs text-muted-foreground">Pick a style you like</p>

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
