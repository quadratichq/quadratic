import { Skeleton } from '@/shared/shadcn/ui/skeleton';

type UserPromptSuggestionsProps = {
  args: string;
  loading: boolean;
};

export const UserPromptSuggestionsSkeleton = ({ loading }: UserPromptSuggestionsProps) => {
  if (loading) {
    return (
      <div>
        <div className="mb-1 mt-1 flex flex-row">
          <Skeleton className="mb-2 mr-4 h-6 w-6  rounded-md" />
          <Skeleton className="mb-2 h-6 w-6 rounded-md" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-full rounded-md" />
          <Skeleton className="h-8 w-full rounded-md" />
          <Skeleton className="h-8 w-full rounded-md" />
        </div>
      </div>
    );
  }

  return null;
};
