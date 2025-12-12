import { ThemeCustomization } from '@/shared/components/ThemeCustomization';

export function ThemeSettings() {
  return (
    <div className="space-y-6">
      {/* Theme Customization Section */}
      <div className="space-y-4">
        <div>
          <p className="text-sm font-normal text-muted-foreground">Pick a style that fits you</p>
        </div>

        <div className="space-y-4 [&_h3]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold">
          <ThemeCustomization />
        </div>
      </div>
    </div>
  );
}
