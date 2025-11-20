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

const EXAMPLE_PROMPTS = [
  'Sales data for Q1 2024 with revenue, costs, and profit margins',
  'Employee database with names, departments, salaries, and hire dates',
  'Product inventory with SKUs, quantities, prices, and suppliers',
  'Monthly budget tracker for personal finance',
  'Customer feedback survey results with ratings and comments',
  'Project management tracker with tasks, deadlines, and status',
];

export const Component = () => {
  useRemoveInitialLoadingUI();
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement AI spreadsheet generation
    console.log('Generating spreadsheet with prompt:', prompt);
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
            <h1 className="mb-3 text-3xl font-bold">Generate from prompt</h1>
            <p className="text-base text-muted-foreground">Describe the spreadsheet you'd like to create</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="What data would you like to start with? Be as specific or general as you'd like..."
                className="min-h-32 resize-none text-base"
                autoFocus
              />
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={!prompt.trim()}>
              Generate Spreadsheet
            </Button>
          </form>

          <div className="mt-8">
            <p className="mb-3 text-sm font-medium text-muted-foreground">Example prompts:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((example, index) => (
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
