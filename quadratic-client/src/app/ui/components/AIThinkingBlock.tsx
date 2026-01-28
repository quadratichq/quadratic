import { Markdown } from '@/app/ui/components/Markdown';
import { ChevronRightIcon } from '@radix-ui/react-icons';
import type { AIResponseContent } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

// Props for the thinking block
interface AIThinkingBlockProps {
  isCurrentMessage: boolean;
  isLoading: boolean;
  thinkingContent: AIResponseContent[number];
  onContentChange?: (content: AIResponseContent[number]) => void;
}
export const AIThinkingBlock = memo(
  ({ isCurrentMessage, isLoading, thinkingContent, onContentChange }: AIThinkingBlockProps) => {
    // Each thinking block tracks its own expanded state - always collapsed by default
    const [isExpanded, setIsExpanded] = useState(false);
    const [showThinkingContent, setShowThinkingContent] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const isActivelyThinking = isLoading && isCurrentMessage;

    // After 1 second of loading, show the thinking content
    useEffect(() => {
      if (isActivelyThinking && !isExpanded) {
        const timer = setTimeout(() => {
          setShowThinkingContent(true);
        }, 1000);

        return () => clearTimeout(timer);
      } else if (!isActivelyThinking) {
        setShowThinkingContent(false);
      }
    }, [isActivelyThinking, isExpanded]);

    // Auto-scroll to bottom when new thinking content arrives
    useEffect(() => {
      if (scrollContainerRef.current && isActivelyThinking && showThinkingContent && !isExpanded) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    }, [thinkingContent.text, isActivelyThinking, showThinkingContent, isExpanded]);

    const toggleExpanded = useCallback(() => {
      setIsExpanded((prev) => !prev);
    }, []);

    const handleContentChange = useCallback(
      (text: string) => {
        onContentChange?.({ ...thinkingContent, text });
      },
      [onContentChange, thinkingContent]
    );

    // Determine the label based on state
    const getLabel = () => {
      if (isActivelyThinking) return 'Thinking';
      return 'Thought';
    };

    return (
      <div className="flex flex-col">
        <div
          className="group flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={toggleExpanded}
        >
          <span
            className={`select-none ${
              isActivelyThinking
                ? 'animate-shimmer bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-[length:200%_100%] bg-clip-text text-transparent'
                : ''
            }`}
          >
            {getLabel()}
          </span>
          <ChevronRightIcon
            className={`h-3 w-3 opacity-0 transition-transform duration-200 group-hover:opacity-100 ${
              isExpanded ? 'rotate-90' : ''
            }`}
          />
        </div>

        {isExpanded && (
          <div className="mt-1 italic text-muted-foreground [&_blockquote]:border-0 [&_blockquote]:pl-0">
            <Markdown text={thinkingContent.text} onChange={onContentChange && handleContentChange} />
          </div>
        )}

        {!isExpanded && isActivelyThinking && showThinkingContent && thinkingContent.text && (
          <div ref={scrollContainerRef} className="mt-1 max-h-24 overflow-hidden text-xs italic text-muted-foreground">
            <p className="whitespace-pre-wrap">{thinkingContent.text}</p>
          </div>
        )}
      </div>
    );
  }
);
