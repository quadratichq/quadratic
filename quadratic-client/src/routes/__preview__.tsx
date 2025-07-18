import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { Suspense, lazy } from 'react';
import { useParams } from 'react-router';

export const loader = () => {
  return null;
};

export function Component() {
  const { '*': path } = useParams();

  useRemoveInitialLoadingUI();

  // Assume you want to import from something like `src/components/Button.tsx`
  const Component = lazy(() => {
    const fullPath = `../${path}.__preview__.tsx`;
    return import(/* @vite-ignore */ fullPath);
  });

  return (
    <Suspense fallback={null}>
      <div className="h-full w-full overflow-auto p-4">
        <Component />
      </div>
    </Suspense>
  );
}

export function ErrorBoundary() {
  return <div>Something went wrong with the preview component.</div>;
}
