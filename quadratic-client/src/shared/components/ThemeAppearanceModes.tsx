import { AppearanceDarkModeIcon, AppearanceLightModeIcon, AppearanceSystemModeIcon } from '@/shared/components/Icons';
import { appearanceModes, useThemeAppearanceMode } from '@/shared/hooks/useThemeAppearanceMode';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';

export function ThemeAppearanceModes() {
  const [appearanceMode, setAppearanceMode] = useThemeAppearanceMode();
  return appearanceModes.map((mode) => (
    <Button
      key={mode}
      size="sm"
      variant="outline"
      className={cn(mode === appearanceMode && 'border-2 border-foreground', 'justify-start gap-1 capitalize')}
      onClick={() => {
        setAppearanceMode(mode);
        trackEvent('[Theme].changeAppearanceMode', {
          appearanceMode: mode,
        });
      }}
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
