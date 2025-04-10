import { cn } from '@/shared/shadcn/utils';

export function RootLoadingIndicator({ children }: { children?: React.ReactNode }) {
  const classNames = `animate-[fadeIn_0.5s_ease-in-out_0.5s_forwards] opacity-0 transition-opacity`;

  // TODO: this should be the same markaup as what you find in index.html
  // so it seamlessly transitions from one to the next
  return (
    <div className="root-loader">
      <div>
        <img src="/images/logo_etching.png" alt="Loading Quadratic Grid" />

        {/* This is NEW to this component, we load it in... */}
        <img
          src="/images/logo_loading.gif"
          alt="Loading Quadratic Grid"
          className={cn('absolute left-0 top-0', classNames)}
        />
        <div className={cn('absolute left-0 top-full mt-4 w-full', classNames)}>{children}</div>
      </div>
    </div>
  );
}
