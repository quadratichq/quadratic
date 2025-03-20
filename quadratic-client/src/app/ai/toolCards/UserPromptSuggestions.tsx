import { Skeleton } from '@mui/material';

type UserPromptSuggestionsProps = {
  args: string;
  loading: boolean;
};

export const UserPromptSuggestions = ({ loading }: UserPromptSuggestionsProps) => {
  if (loading) {
    return (
      <>
        <Skeleton className="h-8 w-full rounded-md" />
        <Skeleton className="h-8 w-full rounded-md" />
        <Skeleton className="h-8 w-full rounded-md" />
      </>
    );
  }

  return null;
};
