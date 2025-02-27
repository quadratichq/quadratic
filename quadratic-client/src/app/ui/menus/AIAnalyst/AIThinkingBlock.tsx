import { Markdown } from '@/app/ui/components/Markdown';
import { cn } from '@/shared/shadcn/utils';
import { ChevronDownIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import type { Content } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback, useEffect, useRef, useState } from 'react';

// Props for the thinking block
interface ThinkingBlockProps {
  isCurrentMessage: boolean;
  isLoading: boolean;
  thinkingContent: Content[number];
  expandedDefault: boolean;
}

export function ThinkingBlock({ isCurrentMessage, isLoading, thinkingContent, expandedDefault }: ThinkingBlockProps) {
  // Each thinking block tracks its own expanded state
  const [isExpanded, setIsExpanded] = useState(isLoading && isCurrentMessage && expandedDefault);
  // Track whether this is the first load completion
  const firstLoadCompletedRef = useRef(false);

  // Update expanded state when loading changes
  useEffect(() => {
    if (isLoading && isCurrentMessage && expandedDefault) {
      // Always show thinking while loading the current message
      setIsExpanded(true);
    } else if (!isLoading && !firstLoadCompletedRef.current) {
      firstLoadCompletedRef.current = true;
      setIsExpanded(false);
    }
  }, [isLoading, isCurrentMessage, expandedDefault]);

  const toggleExpanded = useCallback(() => {
    // Only allow toggling if not loading or not the current message
    if (!(isLoading && isCurrentMessage)) {
      setIsExpanded((prev) => !prev);
    }
  }, [isLoading, isCurrentMessage]);

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
          <Markdown>{thinkingContent.text}</Markdown>
        </div>
      )}
    </div>
  );
}
