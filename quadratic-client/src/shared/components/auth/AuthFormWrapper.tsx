import { forwardRef, memo } from 'react';

export const AuthFormWrapper = memo(
  forwardRef<HTMLDivElement, React.PropsWithChildren<{}>>((props, _ref) => {
    return (
      <main className="flex h-screen select-none flex-col items-center justify-center bg-background">
        <div className="relative flex w-[400px] flex-col overflow-hidden rounded-md bg-white font-sans text-base font-normal leading-4 text-gray-900 antialiased shadow-[0_12px_40px_0_rgba(0,0,0,0.12)]">
          <div className="flex flex-grow flex-col items-center justify-center gap-6 p-10">
            <img src="/logo192.png" alt="Quadratic Logo" className="h-12 w-12" />

            {props.children}
          </div>
        </div>
      </main>
    );
  })
);
