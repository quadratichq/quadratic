import { Markdown } from '@/app/ui/components/Markdown';
import { ChevronDownIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import type { AIResponseContent } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useState } from 'react';

// Props for the thinking block
interface AIThinkingBlockProps {
  isCurrentMessage: boolean;
  isLoading: boolean;
  thinkingContent: AIResponseContent[number];
  expandedDefault: boolean;
  onContentChange?: (content: AIResponseContent[number]) => void;
}
export const AIThinkingBlock = memo(
  ({ isCurrentMessage, isLoading, thinkingContent, expandedDefault, onContentChange }: AIThinkingBlockProps) => {
    // Each thinking block tracks its own expanded state - always collapsed by default
    const [isExpanded, setIsExpanded] = useState(false);

    const toggleExpanded = useCallback(() => {
      setIsExpanded((prev) => !prev);
    }, []);

    const handleContentChange = useCallback(
      (text: string) => {
        onContentChange?.({ ...thinkingContent, text });
      },
      [onContentChange, thinkingContent]
    );

    // Hide component completely once thinking completes
    if (!(isLoading && isCurrentMessage)) {
      return null;
    }

    return (
      <div className="flex flex-col">
        <div
          className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={toggleExpanded}
        >
          <span
            className={`select-none ${
              !isExpanded && isLoading
                ? 'animate-shimmer bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-[length:200%_100%] bg-clip-text text-transparent'
                : ''
            }`}
          >
            {isExpanded ? 'Hide thinking' : 'Thinking'}
          </span>
          {isExpanded ? <ChevronDownIcon className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />}
        </div>

        {isExpanded && (
          <div className="mt-1 border-l-2 border-muted-foreground/40 pl-4 italic text-muted-foreground">
            <Markdown text={thinkingContent.text} onChange={onContentChange && handleContentChange} />
          </div>
        )}
      </div>
    );
  }
);
