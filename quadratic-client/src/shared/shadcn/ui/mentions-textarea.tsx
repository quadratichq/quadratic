import { useGetMentions } from '@/app/ui/hooks/useGetMentions';
import { cn } from '@/shared/shadcn/utils';
import React, {
  cloneElement,
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface MentionItem {
  id: string;
  label: string;
  value: string;
  description?: string;
  icon?: React.ReactNode;
}

export interface MentionsTextareaProps {
  onMentionSearch?: (query: string) => void;
  onMentionSelect?: (mention: MentionItem) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  mentionState: MentionState;
  setMentionState: React.Dispatch<React.SetStateAction<MentionState>>;
  children: React.ReactElement<React.TextareaHTMLAttributes<HTMLTextAreaElement>>;
}

export interface MentionState {
  isOpen: boolean;
  query: string;
  startIndex: number;
  endIndex: number;
  position: { top: number; left: number };
  selectedIndex: number;
}

export const useMentionsState = () => {
  return useState<MentionState>({
    isOpen: false,
    query: '',
    startIndex: -1,
    endIndex: -1,
    position: { top: 0, left: 0 },
    selectedIndex: 0,
  });
};

const MentionsTextarea = memo(
  forwardRef<HTMLTextAreaElement, MentionsTextareaProps>(
    ({ onMentionSearch, onMentionSelect, textareaRef, mentionState, setMentionState, children }, ref) => {
      const mentionItemRefs = useRef<(HTMLDivElement | null)[]>([]);
      const lastProcessedValue = useRef<string>('');
      const lastProcessedCursor = useRef<number>(-1);

      useImperativeHandle(ref, () => textareaRef.current!);

      // Scroll selected mention item into view
      const scrollSelectedIntoView = useCallback((selectedIndex: number) => {
        const selectedItem = mentionItemRefs.current[selectedIndex];
        if (selectedItem) {
          selectedItem.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          });
        }
      }, []);

      // Get cursor position in textarea
      const getCursorPosition = useCallback(() => {
        const textarea = textareaRef?.current;
        if (!textarea) return { top: 0, left: 0 };

        const rect = textarea.getBoundingClientRect();
        const style = getComputedStyle(textarea);
        const lineHeight = parseInt(style.lineHeight) || 20;
        const paddingTop = parseInt(style.paddingTop) || 0;
        const paddingLeft = parseInt(style.paddingLeft) || 0;

        // Create a temporary div to measure text up to cursor
        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.visibility = 'hidden';
        div.style.whiteSpace = 'pre-wrap';
        div.style.wordWrap = 'break-word';
        div.style.font = style.font;
        div.style.width = textarea.clientWidth + 'px';
        div.style.padding = style.padding;
        div.style.border = style.border;
        div.style.boxSizing = style.boxSizing;

        const textBeforeCursor = textarea.value.substring(0, textarea.selectionStart || 0);
        div.textContent = textBeforeCursor;

        document.body.appendChild(div);
        const textHeight = div.offsetHeight;
        document.body.removeChild(div);

        // Calculate position
        const lines = Math.floor(textHeight / lineHeight);
        const top = rect.top + paddingTop + lines * lineHeight;
        const left = rect.left + paddingLeft;

        return { top, left };
      }, [textareaRef]);

      // Detect @ mentions in text
      const detectMention = useCallback((text: string, cursorPos: number) => {
        const textBeforeCursor = text.substring(0, cursorPos);
        const atIndex = textBeforeCursor.lastIndexOf('@');

        if (atIndex === -1) return null;

        // Check if there's a space after @ (not a mention)
        const textAfterAt = textBeforeCursor.substring(atIndex + 1);
        if (textAfterAt.includes(' ')) return null;

        // Check if we're still typing the mention (no space after @)
        const textAfterCursor = text.substring(cursorPos);
        const nextSpaceIndex = textAfterCursor.indexOf(' ');
        const endOfText = textAfterCursor.length === 0;

        if (nextSpaceIndex === 0 && !endOfText) return null;

        const query = textAfterAt;
        const startIndex = atIndex;
        const endIndex = cursorPos;

        return {
          query,
          startIndex,
          endIndex,
        };
      }, []);

      // Filter mentions based on query
      const mentions = useGetMentions(mentionState.query);
      const filteredMentions = useMemo(() => {
        if (!mentionState.query) return mentions;
        return mentions.filter(
          (mention) =>
            mention.label.toLowerCase().includes(mentionState.query.toLowerCase()) ||
            mention.value.toLowerCase().includes(mentionState.query.toLowerCase())
        );
      }, [mentions, mentionState.query]);

      // Check for mentions when textarea changes
      const checkForMentions = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const currentValue = textarea.value;
        const currentCursor = textarea.selectionStart || 0;

        // Only process if value or cursor position changed
        if (currentValue === lastProcessedValue.current && currentCursor === lastProcessedCursor.current) {
          return;
        }

        lastProcessedValue.current = currentValue;
        lastProcessedCursor.current = currentCursor;

        const mention = detectMention(currentValue, currentCursor);

        if (mention) {
          const position = getCursorPosition();
          setMentionState({
            isOpen: true,
            query: mention.query,
            startIndex: mention.startIndex,
            endIndex: mention.endIndex,
            position,
            selectedIndex: 0,
          });
          onMentionSearch?.(mention.query);
        } else {
          setMentionState((prev) => ({ ...prev, isOpen: false }));
        }
      }, [detectMention, getCursorPosition, onMentionSearch, setMentionState, textareaRef]);

      // Handle mention selection
      const handleMentionSelect = useCallback(
        (mention: MentionItem) => {
          const textarea = textareaRef?.current;
          if (!textarea) return;

          const currentValue = textarea.value;
          const beforeMention = currentValue.substring(0, mentionState.startIndex);
          const afterMention = currentValue.substring(mentionState.endIndex);
          const newValue = beforeMention + `@${mention.value} ` + afterMention;

          // Update textarea value
          textarea.value = newValue;

          // Update our tracking variables to prevent re-processing
          const newCursorPos = beforeMention.length + mention.value.length + 2; // +2 for @ and space
          lastProcessedValue.current = newValue;
          lastProcessedCursor.current = newCursorPos;

          // Trigger a change event on the original textarea
          const event = new Event('input', { bubbles: true });
          textarea.dispatchEvent(event);

          setMentionState((prev) => ({ ...prev, isOpen: false }));
          onMentionSelect?.(mention);

          // Focus back to textarea and position cursor after the mention
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
          }, 0);
        },
        [mentionState, onMentionSelect, setMentionState, textareaRef]
      );

      // Add event listeners to the textarea
      useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        // Listen for input events to detect mentions
        const handleInput = () => {
          // Use setTimeout to ensure the textarea value is updated
          setTimeout(checkForMentions, 0);
        };

        // Listen for keydown events for mention navigation
        const handleKeyDown = (event: KeyboardEvent) => {
          if (mentionState.isOpen) {
            if (event.key === 'Escape') {
              setMentionState((prev) => ({ ...prev, isOpen: false }));
              event.preventDefault();
              event.stopPropagation();
              return;
            }

            if (event.key === 'ArrowDown') {
              event.preventDefault();
              event.stopPropagation();
              const newIndex = Math.min(mentionState.selectedIndex + 1, filteredMentions.length - 1);
              setMentionState((prev) => ({
                ...prev,
                selectedIndex: newIndex,
              }));
              setTimeout(() => scrollSelectedIntoView(newIndex), 0);
              return;
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault();
              event.stopPropagation();
              const newIndex = Math.max(mentionState.selectedIndex - 1, 0);
              setMentionState((prev) => ({
                ...prev,
                selectedIndex: newIndex,
              }));
              setTimeout(() => scrollSelectedIntoView(newIndex), 0);
              return;
            }

            if ((event.key === 'Enter' || event.key === 'Tab') && filteredMentions.length > 0) {
              event.preventDefault();
              event.stopPropagation();
              const selectedMention = filteredMentions[mentionState.selectedIndex];
              if (selectedMention) {
                handleMentionSelect(selectedMention);
              }
              return;
            }
          }
        };

        textarea.addEventListener('input', handleInput);
        textarea.addEventListener('keydown', handleKeyDown);

        return () => {
          textarea.removeEventListener('input', handleInput);
          textarea.removeEventListener('keydown', handleKeyDown);
        };
      }, [
        mentionState.isOpen,
        mentionState.selectedIndex,
        filteredMentions,
        checkForMentions,
        handleMentionSelect,
        scrollSelectedIntoView,
        setMentionState,
        textareaRef,
      ]);

      // Update refs array when filtered mentions change
      useEffect(() => {
        mentionItemRefs.current = mentionItemRefs.current.slice(0, filteredMentions.length);
      }, [filteredMentions.length]);

      // Handle click outside to close mentions
      useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
          if (mentionState.isOpen && textareaRef.current) {
            const target = event.target as Node;
            const isInTextarea = textareaRef.current.contains(target);
            const isInMentionsDropdown = document.querySelector('[data-mentions-dropdown]')?.contains(target);

            if (!isInTextarea && !isInMentionsDropdown) {
              setMentionState((prev) => ({ ...prev, isOpen: false }));
            }
          }
        };

        if (mentionState.isOpen) {
          document.addEventListener('mousedown', handleClickOutside);
          return () => document.removeEventListener('mousedown', handleClickOutside);
        }
      }, [mentionState.isOpen, setMentionState, textareaRef]);

      // Clone the child element and ensure the ref is properly attached
      const enhancedChild = cloneElement(children, {
        ref: textareaRef,
        ...children.props,
      });

      return (
        <div className="relative">
          {/* Render the actual textarea child */}
          {enhancedChild}

          {mentionState.isOpen && filteredMentions.length > 0 && (
            <div
              data-mentions-dropdown
              className="absolute z-50 w-80 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
              style={{
                position: 'fixed',
                top: mentionState.position.top - 24,
                left: mentionState.position.left,
                transform: 'translateY(-100%)',
                pointerEvents: 'auto',
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="max-h-60 space-y-0.5 overflow-y-auto">
                {filteredMentions.map((mention, index) => (
                  <div
                    key={mention.id}
                    ref={(el) => {
                      mentionItemRefs.current[index] = el;
                    }}
                    onClick={() => {
                      handleMentionSelect(mention);
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                    className={cn(
                      'cursor-pointer rounded-sm px-2 py-1.5 text-sm transition-colors',
                      index === mentionState.selectedIndex
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <div className="flex flex-row items-center justify-between">
                      <div className="flex flex-row items-center gap-2">
                        {mention.icon && mention.icon}
                        <span className="font-medium">{mention.label}</span>
                      </div>
                      {mention.description && (
                        <span className="text-xs text-muted-foreground">{mention.description}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
  )
);

MentionsTextarea.displayName = 'MentionsTextarea';

export { MentionsTextarea };
