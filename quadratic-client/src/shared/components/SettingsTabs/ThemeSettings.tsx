import { ThemeCustomization } from '@/shared/components/ThemeCustomization';

export function ThemeSettings() {
  return (
    <div className="space-y-6">
      {/* Theme Customization Section */}
      <div className="space-y-4">
        <div>
          <p className="text-sm font-normal text-muted-foreground">Pick a style that fits you</p>
        </div>

        <ThemeCustomization />
      </div>
    </div>
  );
}
