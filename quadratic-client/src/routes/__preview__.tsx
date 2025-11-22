import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { Suspense, lazy } from 'react';
import { useParams } from 'react-router';

/**
 * This route is used to preview components in development mode.
 * Any component in `src/` can have a corresponding preview which can be viewed at this route.
 *
 * Example of files in `src/`:
 *
 * | Component               | Preview component                   | Route
 * |-------------------------|-------------------------------------|--------------
 * | `components/Button.tsx` | `components/Button.__preview__.tsx` | `localhost:3000/__preview__/components/Button`
 *
 * This is purely useful for development purposes when understanding how pure
 * components will look and behave in different states.
 */
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
  return <div>Something went wrong with the preview component. Make sure you’re doing `__preview__/:path`</div>;
}
