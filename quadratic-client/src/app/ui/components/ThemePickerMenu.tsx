import { focusGrid } from '@/app/helpers/focusGrid';
import { SidebarToggle, SidebarTooltip } from '@/app/ui/QuadraticSidebar';
import { ThemeIcon } from '@/shared/components/Icons';
import { ThemeCustomization } from '@/shared/components/ThemeCustomization';
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

        <ThemeCustomization />
      </PopoverContent>
    </Popover>
  );
};
