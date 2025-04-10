export function RootLoadingIndicator({ children }: { children?: React.ReactNode }) {
  return (
    <div className="root-loader" id="root-loading-indicator">
      <div>
        <img src="/images/logo_etching.png" alt="Quadratic logo etching" />
        <img src="/images/logo_loading.gif" alt="Quadratic logo animation" className="absolute left-0 top-0" />
        <div className="absolute left-0 top-full mt-4 w-full">{children}</div>
      </div>
    </div>
  );
}
