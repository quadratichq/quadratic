import { requireAuth } from '@/auth/auth';
import { ROUTES } from '@/shared/constants/routes';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { ChevronLeftIcon } from '@radix-ui/react-icons';
import type { LoaderFunctionArgs } from 'react-router';
import { Link } from 'react-router';

export const loader = async (loaderArgs: LoaderFunctionArgs) => {
  // Require authentication to access this page
  await requireAuth(loaderArgs.request);
  return null;
};

export const Component = () => {
  useRemoveInitialLoadingUI();

  return (
    <div className="relative flex h-full flex-col bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-purple-950/20 dark:via-blue-950/20 dark:to-indigo-950/20">
      {/* Back button in top left */}
      <Link
        to={ROUTES.FILES_CREATE_AI}
        className="absolute left-6 top-6 z-10 flex h-12 w-12 items-center justify-center rounded-lg border-2 border-border bg-background text-foreground shadow-sm transition-all hover:border-primary hover:shadow-md"
      >
        <ChevronLeftIcon className="h-5 w-5" />
      </Link>

      {/* Main content area */}
      <main className="flex flex-1 justify-center overflow-auto p-6 pt-16">
        <div className="w-full max-w-2xl text-center">
          <h1 className="mb-4 text-3xl font-bold">Upload File</h1>
          <p className="mb-6 text-muted-foreground">
            Upload a CSV, Excel, or Parquet file to create an AI-powered spreadsheet
          </p>
          {/* TODO: Add file upload component */}
          <div className="rounded-lg border-2 border-dashed border-border p-12">
            <p className="text-muted-foreground">File upload coming soon...</p>
          </div>
        </div>
      </main>
    </div>
  );
};
