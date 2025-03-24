import { cn } from '@/shared/shadcn/utils';
import { useEffect, useState } from 'react';

export function RootLoadingIndicator({ children }: { children?: React.ReactNode }) {
  // const mountedRef = useRef<boolean>(false);
  const [show, setShow] = useState<boolean>(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(true);
    }, 1500);

    return () => {
      console.log('unmounting');
      clearTimeout(timer);
    };
  }, [show]);

  console.log('RootLoadingIndicator');
  // TODO: this should be the same markup as what you find in index.html
  // so it seamlessly transitions from one to the next
  return (
    <div className="root-loader">
      <div>
        <img src="/public/images/logo_etching.png" alt="Loading Quadratic Grid" />

        {/* This is NEW to this component, we load it in... */}
        <img
          src="/public/images/logo_loading.gif"
          alt="Loading Quadratic Grid"
          className={cn('absolute left-0 top-0 opacity-0 transition-opacity', show && 'opacity-100')}
        />
        {show && <div className="absolute left-0 top-full mt-4 w-full">{children}</div>}
      </div>
    </div>
  );
}
