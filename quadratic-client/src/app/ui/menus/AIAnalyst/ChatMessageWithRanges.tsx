import { memo, useEffect, useState } from 'react';
import { useRangeHighlights } from './hooks/useRangeHighlights';
import { parseRangesFromText, type ParsedRange } from './utils/rangeParser';
import { Markdown } from '@/app/ui/components/Markdown';
import { cn } from '@/shared/shadcn/utils';

interface ChatMessageWithRangesProps {
  content: string;
  messageId: string;
  className?: string;
  onRangeHover?: (range: string) => void;
  onRangeClick?: (range: string) => void;
  autoHighlight?: boolean; // If true, highlights ranges immediately without hover
}

export const ChatMessageWithRanges = memo(
  ({
    content,
    messageId,
    className,
    onRangeHover,
    onRangeClick,
    autoHighlight = false,
  }: ChatMessageWithRangesProps) => {
    const { addHighlightsFromText, removeHighlightsByMessageId } = useRangeHighlights();
    const [parsedRanges, setParsedRanges] = useState<ParsedRange[]>([]);
    const [isHighlighted, setIsHighlighted] = useState(false);

    // Parse ranges when content changes
    useEffect(() => {
      const ranges = parseRangesFromText(content);
      setParsedRanges(ranges);
    }, [content]);

    // Auto-highlight ranges when autoHighlight is enabled
    useEffect(() => {
      if (autoHighlight && parsedRanges.length > 0 && !isHighlighted) {
        addHighlightsFromText(content, messageId);
        setIsHighlighted(true);
      }
    }, [autoHighlight, parsedRanges.length, content, messageId, addHighlightsFromText, isHighlighted]);

    // Clean up highlights when component unmounts or autoHighlight is disabled
    useEffect(() => {
      return () => {
        if (isHighlighted) {
          removeHighlightsByMessageId(messageId);
        }
      };
    }, [messageId, removeHighlightsByMessageId, isHighlighted]);

    // Toggle highlights when message is hovered (only when autoHighlight is disabled)
    const handleMessageHover = (hover: boolean) => {
      if (autoHighlight) return; // Don't handle hover when autoHighlight is enabled

      if (hover && !isHighlighted && parsedRanges.length > 0) {
        addHighlightsFromText(content, messageId);
        setIsHighlighted(true);
      } else if (!hover && isHighlighted) {
        removeHighlightsByMessageId(messageId);
        setIsHighlighted(false);
      }
    };

    // Create interactive text with highlighted ranges
    const renderContentWithRanges = () => {
      if (parsedRanges.length === 0) {
        return content;
      }

      const parts = [];
      let lastIndex = 0;

      for (const range of parsedRanges) {
        // Add text before the range
        if (range.startIndex > lastIndex) {
          parts.push(content.slice(lastIndex, range.startIndex));
        }

        // Add the highlighted range
        parts.push(
          <span
            key={`${messageId}-${range.startIndex}`}
            className={cn(
              'inline-flex items-center rounded px-1 py-0.5 font-mono text-xs',
              'border border-blue-200 bg-blue-100 text-blue-800',
              'cursor-pointer transition-colors hover:bg-blue-200',
              'font-semibold'
            )}
            onMouseEnter={() => onRangeHover?.(range.range)}
            onClick={() => onRangeClick?.(range.range)}
            title={`Click to select ${range.range}${range.sheetName ? ` in ${range.sheetName}` : ''}`}
          >
            {range.text}
          </span>
        );

        lastIndex = range.endIndex;
      }

      // Add remaining text
      if (lastIndex < content.length) {
        parts.push(content.slice(lastIndex));
      }

      return parts;
    };

    return (
      <div
        className={className}
        onMouseEnter={() => handleMessageHover(true)}
        onMouseLeave={() => handleMessageHover(false)}
      >
        {parsedRanges.length > 0 ? renderContentWithRanges() : <Markdown text={content} />}
      </div>
    );
  }
);
