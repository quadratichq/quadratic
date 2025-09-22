import { useGetMentions } from '@/app/ui/hooks/useGetMentions';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { cn } from '@/shared/shadcn/utils';
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';

export interface MentionItem {
  id: string;
  label: string;
  value: string;
  description?: string;
  icon?: React.ReactNode;
}

export interface MentionsTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value?: string;
  onMentionSearch?: (query: string) => void;
  onMentionSelect?: (mention: MentionItem) => void;
  onChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  mentionState: MentionState;
  setMentionState: React.Dispatch<React.SetStateAction<MentionState>>;
  maxHeight?: string;
}

export interface MentionState {
  isOpen: boolean;
  query: string;
  startIndex: number;
  endIndex: number;
  position: { top: number; left: number };
  selectedIndex: number;
}

const MentionsTextarea = memo(
  forwardRef<HTMLTextAreaElement, MentionsTextareaProps>(
    (
      {
        className,
        onChange,
        onKeyDown,
        style,
        value = '',
        // mentions = [],
        maxHeight,
        mentionState,
        setMentionState,
        onMentionSearch,
        onMentionSelect,
        placeholder = 'Type @ to mention someone...',
        textareaRef,
        ...props
      },
      ref
    ) => {
      const mentionItemRefs = useRef<(HTMLDivElement | null)[]>([]);

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

      // const adjustHeight = useCallback(() => {
      //   window.requestAnimationFrame(() => {
      //     const textarea = textareaRef.current;
      //     if (textarea) {
      //       textarea.style.height = '';
      //       textarea.style.height = `${textarea.scrollHeight}px`;
      //     }
      //   });
      // }, [textareaRef]);

      // const resetHeight = useCallback(() => {
      //   const textarea = textareaRef.current;
      //   if (textarea) {
      //     textarea.style.height = '';
      //   }
      // }, [textareaRef]);

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

        const textBeforeCursor = value.substring(0, textarea.selectionStart);
        div.textContent = textBeforeCursor;

        document.body.appendChild(div);
        const textHeight = div.offsetHeight;
        document.body.removeChild(div);

        // Calculate position
        const lines = Math.floor(textHeight / lineHeight);
        const top = rect.top + paddingTop + lines * lineHeight;
        const left = rect.left + paddingLeft;

        return { top, left };
      }, [value, textareaRef]);

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

      // Handle text change
      const handleChange = useCallback(
        (event: React.ChangeEvent<HTMLTextAreaElement>) => {
          const newValue = event.target.value;
          const cursorPos = event.target.selectionStart || 0;

          const mention = detectMention(newValue, cursorPos);

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

          onChange?.(event);

          // if (autoHeight) {
          //   adjustHeight();
          // }
        },
        [detectMention, getCursorPosition, onChange, onMentionSearch, setMentionState]
      );

      // Handle mention selection
      const handleMentionSelect = useCallback(
        (mention: MentionItem) => {
          console.log('handleMentionSelect', mention, textareaRef?.current);
          const textarea = textareaRef?.current;
          if (!textarea) return;

          const beforeMention = value.substring(0, mentionState.startIndex);
          const afterMention = value.substring(mentionState.endIndex);
          const newValue = beforeMention + `@${mention.value} ` + afterMention;

          onChange?.({
            target: { value: newValue } as HTMLTextAreaElement,
            currentTarget: textarea,
          } as React.ChangeEvent<HTMLTextAreaElement>);

          setMentionState((prev) => ({ ...prev, isOpen: false }));
          onMentionSelect?.(mention);

          // Focus back to textarea and position cursor after the mention
          setTimeout(() => {
            const newCursorPos = beforeMention.length + mention.value.length + 2; // +2 for @ and space
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
          }, 0);
        },
        [value, mentionState, onChange, onMentionSelect, setMentionState, textareaRef]
      );

      // Handle key down events
      const handleKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
          if (mentionState.isOpen) {
            if (event.key === 'Escape') {
              setMentionState((prev) => ({ ...prev, isOpen: false }));
              event.preventDefault();
              return;
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              const newIndex = Math.min(mentionState.selectedIndex + 1, filteredMentions.length - 1);
              setMentionState((prev) => ({
                ...prev,
                selectedIndex: newIndex,
              }));
              // Scroll the selected item into view after state update
              setTimeout(() => scrollSelectedIntoView(newIndex), 0);
              return;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              const newIndex = Math.max(mentionState.selectedIndex - 1, 0);
              setMentionState((prev) => ({
                ...prev,
                selectedIndex: newIndex,
              }));
              // Scroll the selected item into view after state update
              setTimeout(() => scrollSelectedIntoView(newIndex), 0);
              return;
            }
            if (event.key === 'Enter' && filteredMentions.length > 0) {
              event.preventDefault();
              const selectedMention = filteredMentions[mentionState.selectedIndex];
              if (selectedMention) {
                handleMentionSelect(selectedMention);
              }
              return;
            }
            if (event.key === 'Tab') {
              event.preventDefault();
              if (filteredMentions.length > 0) {
                const selectedMention = filteredMentions[mentionState.selectedIndex];
                if (selectedMention) {
                  handleMentionSelect(selectedMention);
                }
              }
              return;
            }
          }

          onKeyDown?.(event);
        },
        [
          mentionState.isOpen,
          mentionState.selectedIndex,
          filteredMentions,
          onKeyDown,
          setMentionState,
          handleMentionSelect,
          scrollSelectedIntoView,
        ]
      );

      // Update mention position when value changes
      useEffect(() => {
        if (mentionState.isOpen) {
          const position = getCursorPosition();
          setMentionState((prev) => ({ ...prev, position }));
        }
      }, [value, mentionState.isOpen, getCursorPosition, setMentionState]);

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

      return (
        <div className="relative">
          <Textarea
            ref={textareaRef}
            className={cn(
              'min-h-14 rounded-none border-none p-2 pb-0 pt-1 shadow-none focus-visible:ring-0'
              // editingOrDebugEditing ? 'min-h-14' : 'pointer-events-none !max-h-none overflow-hidden',
              // (waitingOnMessageIndex !== undefined || showAIUsageExceeded) && 'pointer-events-none opacity-50'
            )}
            style={{
              ...style,
            }}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            value={value}
            placeholder={placeholder}
            autoHeight
            maxHeight={maxHeight}
            // onFocus={() => {
            //   textareaRef.current?.setSelectionRange(prompt.length, prompt.length);
            // }}
            {...props}
          />

          {mentionState.isOpen && (
            <div
              data-mentions-dropdown
              className="absolute z-50 w-80 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
              style={{
                position: 'fixed',
                top: mentionState.position.top - 24,
                left: mentionState.position.left,
                transform: 'translateY(-100%)',
              }}
            >
              <div className="max-h-60 overflow-y-auto">
                {filteredMentions.length === 0 ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">No matches found</div>
                ) : (
                  <div className="space-y-1">
                    {filteredMentions.map((mention, index) => (
                      <div
                        key={mention.id}
                        ref={(el) => {
                          mentionItemRefs.current[index] = el;
                        }}
                        onClick={() => {
                          console.log('mention', mention);
                          handleMentionSelect(mention);
                        }}
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
                            <span className="text-sm text-muted-foreground">{mention.description}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
