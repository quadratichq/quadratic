import { SpinnerIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { memo } from 'react';

interface EmptyChatSectionProps {
  header: string;
  headerRight?: React.ReactNode;
  isLoading?: boolean;
  children: React.ReactNode;
}

export const EmptyChatSection = memo(({ header, headerRight, isLoading, children }: EmptyChatSectionProps) => {
  return (
    <div className="flex w-full max-w-lg flex-col">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <h2 className="flex shrink-0 items-center gap-2 text-xs font-semibold text-muted-foreground">
          {header}
          {isLoading && <SpinnerIcon className="text-primary" />}
        </h2>
        {headerRight}
      </div>
      <div className="-mx-1 flex flex-col">{children}</div>
    </div>
  );
});

interface SuggestionButtonProps {
  icon: React.ReactNode;
  text: string;
  onClick: () => void;
}

export const SuggestionButton = memo(({ icon, text, onClick }: SuggestionButtonProps) => {
  return (
    <Button
      variant="ghost"
      className="h-auto w-full justify-start gap-2 whitespace-normal px-1 text-left text-sm font-normal text-foreground hover:text-foreground"
      onClick={onClick}
    >
      {icon}
      <span>{text}</span>
    </Button>
  );
});
