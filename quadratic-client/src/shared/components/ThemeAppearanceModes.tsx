import { appearanceModes, themeAppearanceModeAtom } from '@/shared/atoms/themeAppearanceMode';
import { AppearanceDarkModeIcon, AppearanceLightModeIcon, AppearanceSystemModeIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { useRecoilState } from 'recoil';

export function ThemeAppearanceModes() {
  const [appearanceMode, setAppearanceMode] = useRecoilState(themeAppearanceModeAtom);
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
