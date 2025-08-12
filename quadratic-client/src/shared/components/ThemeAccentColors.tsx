import { CheckSmallIcon } from '@/shared/components/Icons';
import { themeAccentColors, useThemeAccentColor } from '@/shared/hooks/useThemeAccentColor';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';

export const ThemeAccentColors = () => {
  const [accentColor, setThemeAccentColor] = useThemeAccentColor();

  return themeAccentColors.map((c) => (
    <Button
      size="sm"
      variant="outline"
      key={c}
      onClick={() => {
        setThemeAccentColor(c);
        trackEvent('[Theme].changeAccentColor', {
          accentColor: c,
        });
      }}
      className={cn(c === accentColor && 'border-2 border-foreground', 'justify-start')}
    >
      <span data-theme={c} className="-ml-1 mr-2 flex h-4 w-4 shrink-0 rounded-full bg-primary">
        {c === accentColor && <CheckSmallIcon className="relative -left-0.5 -top-0.5 text-background" />}
      </span>
      <span className="capitalize">{c === 'black' ? 'Mono' : c}</span>
    </Button>
  ));
};
