import { useEffect, useState } from 'react';

export function RootLoadingIndicator() {
  const [isTakingALongTime, setIsTakingALongTime] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsTakingALongTime(true);
    }, 15000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="root-loader" id="root-loading-indicator">
      <div>
        <img src="/images/logo_etching.png" alt="Quadratic logo etching" />
        <img src="/images/logo_loading.gif" alt="Quadratic logo animation" className="absolute left-0 top-0" />
        <div
          className={
            'absolute left-1/2 top-full mt-4 w-96 -translate-x-1/2 opacity-0 transition-opacity duration-700 ease-in-out ' +
            (isTakingALongTime ? 'opacity-100' : '')
          }
        >
          <div className="text-center text-sm text-muted-foreground">Still loading…</div>
        </div>
      </div>
    </div>
  );
}
