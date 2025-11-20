import { requireAuth } from '@/auth/auth';
import { ROUTES } from '@/shared/constants/routes';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { Button } from '@/shared/shadcn/ui/button';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { ChevronLeftIcon } from '@radix-ui/react-icons';
import { useState } from 'react';
import type { LoaderFunctionArgs } from 'react-router';
import { Link } from 'react-router';

export const loader = async (loaderArgs: LoaderFunctionArgs) => {
  // Require authentication to access this page
  await requireAuth(loaderArgs.request);
  return null;
};

const WEB_SEARCH_PROMPTS = [
  'Top 10 companies in the US by revenue',
  'Latest cryptocurrency prices and market caps',
  'Best rated restaurants in San Francisco',
  'Current weather data for major US cities',
  'Recent news headlines about AI technology',
  'Stock prices for major tech companies',
  'Population statistics for European countries',
  'Best-selling books of 2024',
];

export const Component = () => {
  useRemoveInitialLoadingUI();
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement AI web research
    console.log('Searching web for:', prompt);
  };

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
        <div className="w-full max-w-2xl">
          <div className="mb-8 text-center">
            <h1 className="mb-3 text-3xl font-bold">Web Research</h1>
            <p className="text-base text-muted-foreground">Tell AI what information to search for and gather</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="What information would you like AI to search for on the web?"
                className="min-h-32 resize-none text-base"
                autoFocus
              />
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={!prompt.trim()}>
              Search and Create Spreadsheet
            </Button>
          </form>

          <div className="mt-8">
            <p className="mb-3 text-sm font-medium text-muted-foreground">Example searches:</p>
            <div className="flex flex-wrap gap-2">
              {WEB_SEARCH_PROMPTS.map((example, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="h-auto whitespace-normal px-3 py-2 text-left text-xs font-normal"
                  onClick={() => setPrompt(example)}
                >
                  {example}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
