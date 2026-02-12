import { CheckSmallIcon } from '@/shared/components/Icons';
import { themeAccentColors, useThemeAccentColor } from '@/shared/hooks/useThemeAccentColor';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';

export const ThemeAccentColors = () => {
  const [accentColor, setThemeAccentColor] = useThemeAccentColor();

  return themeAccentColors.map((c) => {
    const displayName = c === 'black' ? 'Mono' : c.charAt(0).toUpperCase() + c.slice(1);
    return (
      <Button
        size="sm"
        variant="outline"
        key={c}
        aria-label={displayName}
        onClick={() => {
          setThemeAccentColor(c);
          trackEvent('[Theme].changeAccentColor', {
            accentColor: c,
          });
        }}
        className={cn(c === accentColor && 'border-2 border-foreground', 'justify-start')}
      >
        <span data-theme={c} className="-ml-1 mr-2 flex h-4 w-4 shrink-0 rounded-full bg-primary" aria-hidden="true">
          {c === accentColor && <CheckSmallIcon className="relative -left-0.5 -top-0.5 text-background" />}
        </span>
        <span>{displayName}</span>
      </Button>
    );
  });
};
