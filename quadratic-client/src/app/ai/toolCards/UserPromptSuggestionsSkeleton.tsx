import { Skeleton } from '@/shared/shadcn/ui/skeleton';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo } from 'react';

export const UserPromptSuggestionsSkeleton = memo(
  ({ toolCall: { loading } }: { toolCall: AIToolCall; className: string }) => {
    if (loading) {
      return (
        <div>
          <div className="mx-2 flex flex-col gap-2">
            <div className="flex w-full flex-row gap-2">
              <Skeleton className="h-7 w-1/3 rounded-md" />
              <Skeleton className="h-7 w-1/3 rounded-md" />
              <Skeleton className="h-7 w-1/3 rounded-md" />
            </div>
          </div>
        </div>
      );
    }

    return null;
  }
);
