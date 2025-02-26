import { Markdown } from '@/app/ui/components/Markdown';
import { cn } from '@/shared/shadcn/utils';
import { ChevronDownIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { useCallback, useEffect, useState } from 'react';

// Type for the message content items
export type MessageContentItem = {
  type: string;
  text: string;
};

// Props for the thinking block
export type ThinkingBlockProps = {
  messageIndex: number;
  isCurrentMessage: boolean;
  isLoading: boolean;
  thinkingContent: MessageContentItem[];
  onToggle: () => void;
};

export function ThinkingBlock({
  messageIndex,
  isCurrentMessage,
  isLoading,
  thinkingContent,
  onToggle,
}: ThinkingBlockProps) {
  // Each thinking block tracks its own expanded state
  const [isExpanded, setIsExpanded] = useState(isLoading && isCurrentMessage);

  // Update expanded state when loading changes
  useEffect(() => {
    if (isLoading && isCurrentMessage) {
      // Always show thinking while loading the current message
      setIsExpanded(true);
    } else if (!isLoading && isCurrentMessage) {
      // Auto-collapse when loading completes
      setIsExpanded(false);
      // Notify parent that the thinking block was collapsed
      onToggle();
    }
  }, [isLoading, isCurrentMessage, onToggle]);

  const toggleExpanded = useCallback(() => {
    // Only allow toggling if not loading or not the current message
    if (!(isLoading && isCurrentMessage)) {
      setIsExpanded((prev) => !prev);
      onToggle();
    }
  }, [isLoading, isCurrentMessage, onToggle]);

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          'flex items-center gap-1 text-xs text-muted-foreground',
          isLoading && isCurrentMessage ? '' : 'cursor-pointer hover:text-foreground'
        )}
        onClick={toggleExpanded}
      >
        {isExpanded ? <ChevronDownIcon className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />}
        <span>{isLoading && isCurrentMessage ? 'Thinking...' : isExpanded ? 'Hide thinking' : 'Show thinking'}</span>
      </div>

      {isExpanded && (
        <div className="mt-1 border-l-2 border-muted-foreground/40 pl-4 italic text-muted-foreground">
          {thinkingContent.map((item) => (
            <div key={item.text}>
              <Markdown>{item.text}</Markdown>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
