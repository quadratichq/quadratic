import { AppearanceDarkModeIcon, AppearanceLightModeIcon, AppearanceSystemModeIcon } from '@/shared/components/Icons';
import { appearanceModes, useTheme } from '@/shared/components/Theme';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';

export function ThemeAppearanceModes() {
  const { appearanceMode, setAppearanceMode } = useTheme();
  return appearanceModes.map((mode) => (
    <Button
      key={mode}
      size="sm"
      variant="outline"
      className={cn(mode === appearanceMode && 'border-2 border-foreground', 'justify-start gap-1 capitalize')}
      onClick={() => setAppearanceMode(mode)}
    >
      {mode === 'light' ? (
        <AppearanceLightModeIcon />
      ) : mode === 'dark' ? (
        <AppearanceDarkModeIcon />
      ) : (
        <AppearanceSystemModeIcon />
      )}
      {mode}
    </Button>
  ));
}
