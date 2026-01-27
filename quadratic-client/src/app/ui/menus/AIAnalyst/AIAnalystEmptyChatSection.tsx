import { SpinnerIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { memo } from 'react';

export interface EmptyChatSectionItem {
  key: string;
  icon: React.ReactNode;
  text: string;
  onClick: () => void;
}

interface EmptyChatSectionProps {
  header: string;
  items: EmptyChatSectionItem[];
  isLoading?: boolean;
  emptyState?: React.ReactNode;
}

export const EmptyChatSection = memo(({ header, items, isLoading, emptyState }: EmptyChatSectionProps) => {
  return (
    <div className="flex w-full max-w-lg flex-col gap-3">
      <h2 className="flex h-6 items-center gap-2 text-xs font-semibold text-muted-foreground">
        {header}
        {isLoading && <SpinnerIcon className="text-primary" />}
      </h2>
      <div className="-mx-1 flex max-w-lg flex-col">
        {items.length > 0
          ? items.map((item) => (
              <Button
                key={item.key}
                variant="ghost"
                className="h-auto w-full justify-start gap-2 whitespace-normal px-1 text-left text-sm font-normal text-foreground hover:text-foreground"
                onClick={item.onClick}
              >
                {item.icon}
                <span>{item.text}</span>
              </Button>
            ))
          : emptyState}
      </div>
    </div>
  );
});
