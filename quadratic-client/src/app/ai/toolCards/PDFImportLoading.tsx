type UserPromptSuggestionsProps = {
  args: string;
  loading: boolean;
};

export const PDFImportLoading = ({ loading }: UserPromptSuggestionsProps) => {
  if (!loading) {
    return null;
  }

  return <div className="text-xs text-muted-foreground">Reading file...</div>;
};
