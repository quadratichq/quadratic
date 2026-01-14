import { Markdown } from '@/app/ui/components/Markdown';
import { ChevronDownIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import type { AIResponseContent } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

// Helper function to extract the last sentence from text
function getLastSentence(text: string): string {
  if (!text) return '';

  // Split by sentence-ending punctuation (., !, ?)
  // Keep the punctuation with the sentence
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];

  // If we have complete sentences, return the last one
  if (sentences.length > 0) {
    return sentences[sentences.length - 1].trim();
  }

  // If no complete sentences, return the entire text (work in progress)
  return text.trim();
}

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
    const [showLastSentence, setShowLastSentence] = useState(false);
    const [thinkingDuration, setThinkingDuration] = useState<number | null>(null);
    const thinkingStartTime = useRef<number | null>(null);

    const isActivelyThinking = isLoading && isCurrentMessage;

    // Track thinking duration
    useEffect(() => {
      if (isActivelyThinking) {
        // Start tracking when thinking begins
        if (thinkingStartTime.current === null) {
          thinkingStartTime.current = Date.now();
        }
      } else if (thinkingStartTime.current !== null) {
        // Calculate duration when thinking ends
        const duration = Math.round((Date.now() - thinkingStartTime.current) / 1000);
        setThinkingDuration(duration);
      }
    }, [isActivelyThinking]);

    // After 1 second of loading, show the last sentence
    useEffect(() => {
      if (isLoading && isCurrentMessage && !isExpanded) {
        const timer = setTimeout(() => {
          setShowLastSentence(true);
        }, 1000);

        return () => clearTimeout(timer);
      } else {
        setShowLastSentence(false);
      }
    }, [isLoading, isCurrentMessage, isExpanded]);

    const toggleExpanded = useCallback(() => {
      setIsExpanded((prev) => !prev);
    }, []);

    const handleContentChange = useCallback(
      (text: string) => {
        onContentChange?.({ ...thinkingContent, text });
      },
      [onContentChange, thinkingContent]
    );

    const lastSentence = getLastSentence(thinkingContent.text);

    // Determine the label based on state
    const getLabel = () => {
      if (isExpanded) return 'Hide thinking';
      if (isActivelyThinking) return 'Thinking';
      if (thinkingDuration !== null) return `Thought for ${thinkingDuration}s`;
      return 'Thought';
    };

    return (
      <div className="flex flex-col">
        <div
          className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={toggleExpanded}
        >
          <span
            className={`select-none ${
              !isExpanded && isActivelyThinking
                ? 'animate-shimmer bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-[length:200%_100%] bg-clip-text text-transparent'
                : ''
            }`}
          >
            {getLabel()}
          </span>
          {isExpanded ? <ChevronDownIcon className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />}
        </div>

        {isExpanded && (
          <div className="mt-1 border-l-2 border-muted-foreground/40 pl-4 italic text-muted-foreground">
            <Markdown text={thinkingContent.text} onChange={onContentChange && handleContentChange} />
          </div>
        )}

        {!isExpanded && isActivelyThinking && showLastSentence && lastSentence && (
          <div className="mt-1 text-xs italic text-muted-foreground">{lastSentence}</div>
        )}
      </div>
    );
  }
);
