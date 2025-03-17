import { ThemeAppearanceModeEffects } from '@/shared/hooks/useThemeAppearanceMode';

export function QuadraticLoading() {
  return (
    <>
      <ThemeAppearanceModeEffects />
      <div className="root-loader">
        <img src="/images/logo_loading.gif" alt="Loading Quadratic Grid" className="root-loader-logo" />
      </div>
    </>
  );
}
