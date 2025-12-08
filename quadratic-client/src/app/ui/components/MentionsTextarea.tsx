import { useGetMentions } from '@/app/ui/hooks/useGetMentions';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
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

export interface MentionColumn {
  name: string;
  display: boolean;
}

export interface MentionItem {
  id: string;
  label: string;
  value: string;
  description?: string;
  icon?: React.ReactNode;
  /** Columns available for this item (e.g., table columns) */
  columns?: MentionColumn[];
}

export interface MentionsTextareaProps {
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
  /** Column selection mode - when user drills down into a table */
  columnMode?: {
    /** The table that was selected */
    tableName: string;
    /** Available columns for the selected table */
    columns: MentionColumn[];
    /** The query for filtering columns (text after [ or .) */
    query: string;
    /** Start index of the column part (after [ or .) */
    startIndex: number;
  };
}

export const useMentionsState = () => {
  return useState<MentionState>({
    isOpen: false,
    query: '',
    startIndex: -1,
    endIndex: -1,
    position: { top: 0, left: 0 },
    selectedIndex: 0,
    columnMode: undefined,
  });
};

// Designed to be used with a <textarea> element as its child.
const MentionsTextarea = memo(
  forwardRef<HTMLTextAreaElement, MentionsTextareaProps>(
    ({ textareaRef, mentionState, setMentionState, children }, ref) => {
      const mentionItemRefs = useRef<(HTMLDivElement | null)[]>([]);
      const columnItemRefs = useRef<(HTMLDivElement | null)[]>([]);
      const lastProcessedValue = useRef<string>('');
      const lastProcessedCursor = useRef<number>(-1);

      useImperativeHandle(ref, () => textareaRef.current!);

      // Scroll selected mention item into view
      const scrollSelectedIntoView = useCallback((selectedIndex: number, isColumnMode: boolean = false) => {
        const refs = isColumnMode ? columnItemRefs : mentionItemRefs;
        const selectedItem = refs.current[selectedIndex];
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
        return getMentionCursorPosition(textarea);
      }, [textareaRef]);

      // Get grouped mentions
      const mentionGroups = useGetMentions(mentionState.query);

      // Flatten mentions for navigation
      const allMentions = useMemo(() => {
        return mentionGroups.flatMap((group) => group.items);
      }, [mentionGroups]);

      // Filter columns when in column mode
      const filteredColumns = useMemo(() => {
        if (!mentionState.columnMode) return [];
        const query = mentionState.columnMode.query.toLowerCase();
        return mentionState.columnMode.columns
          .filter((col) => col.display && col.name.toLowerCase().includes(query))
          .map((col) => col.name);
      }, [mentionState.columnMode]);

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

        // Check if we're in column mode (user typed [ or . after a completed mention)
        const columnTrigger = detectColumnTriggerInText(currentValue, currentCursor, allMentions);
        if (columnTrigger) {
          const position = getCursorPosition();
          setMentionState({
            isOpen: true,
            query: '',
            startIndex: columnTrigger.mentionStartIndex,
            endIndex: currentCursor,
            position,
            selectedIndex: 0,
            columnMode: {
              tableName: columnTrigger.tableName,
              columns: columnTrigger.columns,
              query: columnTrigger.query,
              startIndex: columnTrigger.columnStartIndex,
            },
          });
          return;
        }

        // Regular mention detection
        const mention = detectMentionInText(currentValue, currentCursor);

        if (mention) {
          const position = getCursorPosition();
          setMentionState({
            isOpen: true,
            query: mention.query,
            startIndex: mention.startIndex,
            endIndex: mention.endIndex,
            position,
            selectedIndex: 0,
            columnMode: undefined,
          });
        } else {
          setMentionState((prev) => ({ ...prev, isOpen: false, columnMode: undefined }));
        }
      }, [getCursorPosition, setMentionState, textareaRef, allMentions]);

      // Handle entering column mode via Tab
      const enterColumnMode = useCallback(
        (mention: MentionItem) => {
          const textarea = textareaRef?.current;
          if (!textarea || !mention.columns || mention.columns.length === 0) return;

          // Insert the mention with opening bracket
          const currentValue = textarea.value;
          const beforeMention = currentValue.substring(0, mentionState.startIndex);
          const afterMention = currentValue.substring(mentionState.endIndex);
          const insertText = `@${mention.value}[`;
          const newValue = beforeMention + insertText + afterMention;

          const newCursorPos = beforeMention.length + insertText.length;

          // Use 'end' to position cursor at the end of inserted text immediately
          textarea.setRangeText(insertText, mentionState.startIndex, mentionState.endIndex, 'end');

          // Update tracking variables BEFORE dispatching event to prevent checkForMentions from overwriting state
          lastProcessedValue.current = newValue;
          lastProcessedCursor.current = newCursorPos;

          // Trigger a change event
          const event = new Event('input', { bubbles: true });
          textarea.dispatchEvent(event);

          const position = getCursorPosition();

          // Enter column mode
          setMentionState({
            isOpen: true,
            query: '',
            startIndex: mentionState.startIndex,
            endIndex: newCursorPos,
            position,
            selectedIndex: 0,
            columnMode: {
              tableName: mention.value,
              columns: mention.columns,
              query: '',
              startIndex: newCursorPos,
            },
          });

          textarea.focus();
        },
        [mentionState.startIndex, mentionState.endIndex, setMentionState, textareaRef, getCursorPosition]
      );

      // Handle mention selection (Enter key - complete without column)
      const handleMentionSelect = useCallback(
        (mention: MentionItem) => {
          const textarea = textareaRef?.current;
          if (!textarea) return;

          const currentValue = textarea.value;
          const beforeMention = currentValue.substring(0, mentionState.startIndex);
          const afterMention = currentValue.substring(mentionState.endIndex);
          const newValue = beforeMention + `@${mention.value} ` + afterMention;

          // Update textarea value using setRangeText - use 'end' to position cursor after inserted text
          textarea.setRangeText(`@${mention.value} `, mentionState.startIndex, mentionState.endIndex, 'end');

          // Update our tracking variables to prevent re-processing
          const newCursorPos = beforeMention.length + mention.value.length + 2; // +2 for @ and space
          lastProcessedValue.current = newValue;
          lastProcessedCursor.current = newCursorPos;

          // Trigger a change event on the original textarea
          const event = new Event('input', { bubbles: true });
          textarea.dispatchEvent(event);

          setMentionState((prev) => ({ ...prev, isOpen: false, columnMode: undefined }));

          // Focus back to textarea and position cursor after the mention
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
          }, 0);
        },
        [mentionState.startIndex, mentionState.endIndex, setMentionState, textareaRef]
      );

      // Handle column selection
      const handleColumnSelect = useCallback(
        (columnName: string) => {
          const textarea = textareaRef?.current;
          if (!textarea || !mentionState.columnMode) return;

          const currentValue = textarea.value;
          const beforeMention = currentValue.substring(0, mentionState.startIndex);
          const afterCursor = currentValue.substring(textarea.selectionStart || 0);

          // Build the complete mention with column: @TableName[column_name]
          const insertText = `@${mentionState.columnMode.tableName}[${columnName}] `;
          const newValue = beforeMention + insertText + afterCursor;

          // Use 'end' to position cursor after inserted text
          textarea.setRangeText(insertText, mentionState.startIndex, textarea.selectionStart || 0, 'end');

          const newCursorPos = beforeMention.length + insertText.length;
          lastProcessedValue.current = newValue;
          lastProcessedCursor.current = newCursorPos;

          // Trigger a change event
          const event = new Event('input', { bubbles: true });
          textarea.dispatchEvent(event);

          setMentionState((prev) => ({ ...prev, isOpen: false, columnMode: undefined }));

          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
          }, 0);
        },
        [mentionState.startIndex, mentionState.columnMode, setMentionState, textareaRef]
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
            // Column mode navigation
            if (mentionState.columnMode) {
              if (event.key === 'Escape') {
                // Exit column mode but leave what's typed
                setMentionState((prev) => ({ ...prev, isOpen: false, columnMode: undefined }));
                event.preventDefault();
                event.stopPropagation();
                return;
              }

              if (event.key === 'ArrowDown') {
                event.preventDefault();
                event.stopPropagation();
                const newIndex = Math.min(mentionState.selectedIndex + 1, filteredColumns.length - 1);
                setMentionState((prev) => ({
                  ...prev,
                  selectedIndex: newIndex,
                }));
                setTimeout(() => scrollSelectedIntoView(newIndex, true), 0);
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
                setTimeout(() => scrollSelectedIntoView(newIndex, true), 0);
                return;
              }

              if ((event.key === 'Enter' || event.key === 'Tab') && filteredColumns.length > 0) {
                event.preventDefault();
                event.stopPropagation();
                const selectedColumn = filteredColumns[mentionState.selectedIndex];
                if (selectedColumn) {
                  trackEvent('[AIMentions].selectColumnFromDropdown');
                  handleColumnSelect(selectedColumn);
                }
                return;
              }
              return;
            }

            // Regular mention navigation
            if (event.key === 'Escape') {
              setMentionState((prev) => ({ ...prev, isOpen: false, columnMode: undefined }));
              event.preventDefault();
              event.stopPropagation();
              return;
            }

            if (event.key === 'ArrowDown') {
              event.preventDefault();
              event.stopPropagation();
              const newIndex = Math.min(mentionState.selectedIndex + 1, allMentions.length - 1);
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

            // Tab - drill down into columns if available
            if (event.key === 'Tab' && allMentions.length > 0) {
              const selectedMention = allMentions[mentionState.selectedIndex];
              if (selectedMention?.columns && selectedMention.columns.length > 0) {
                event.preventDefault();
                event.stopPropagation();
                trackEvent('[AIMentions].drillDownToColumns');
                enterColumnMode(selectedMention);
                return;
              }
              // Fall through to regular select if no columns
            }

            if ((event.key === 'Enter' || event.key === 'Tab') && allMentions.length > 0) {
              event.preventDefault();
              event.stopPropagation();
              const selectedMention = allMentions[mentionState.selectedIndex];
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
        mentionState.columnMode,
        allMentions,
        filteredColumns,
        checkForMentions,
        handleMentionSelect,
        handleColumnSelect,
        enterColumnMode,
        scrollSelectedIntoView,
        setMentionState,
        textareaRef,
      ]);

      // Update refs array when mentions/columns change
      useEffect(() => {
        mentionItemRefs.current = mentionItemRefs.current.slice(0, allMentions.length);
      }, [allMentions.length]);

      useEffect(() => {
        columnItemRefs.current = columnItemRefs.current.slice(0, filteredColumns.length);
      }, [filteredColumns.length]);

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
        }

        return () => document.removeEventListener('mousedown', handleClickOutside);
      }, [mentionState.isOpen, setMentionState, textareaRef]);

      // Clone the child element and ensure the ref is properly attached
      const enhancedChild = cloneElement(children, {
        ...children.props,
      });

      // Determine if we should show the dropdown
      const showMentionDropdown = mentionState.isOpen && !mentionState.columnMode && allMentions.length > 0;
      const showColumnDropdown = mentionState.isOpen && mentionState.columnMode && filteredColumns.length > 0;

      return (
        <div className="relative">
          {/* Render the actual textarea child */}
          {enhancedChild}

          {(showMentionDropdown || showColumnDropdown) && (
            <>
              {/* Invisible background overlay that covers the entire page */}
              <div
                className="fixed inset-0 z-40"
                style={{
                  backgroundColor: 'transparent',
                  pointerEvents: 'auto',
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setMentionState((prev) => ({ ...prev, isOpen: false, columnMode: undefined }));
                }}
              />

              {/* Mentions dropdown */}
              {showMentionDropdown && (
                <div
                  data-mentions-dropdown
                  className="absolute z-50 w-96 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
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
                    {mentionGroups.map((group) => (
                      <div key={group.heading}>
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{group.heading}</div>
                        {group.items.map((mention) => {
                          const globalIndex = allMentions.findIndex((m) => m.id === mention.id);
                          const hasColumns = mention.columns && mention.columns.length > 0;
                          const isSelected = globalIndex === mentionState.selectedIndex;
                          return (
                            <div
                              key={mention.id}
                              ref={(el) => {
                                mentionItemRefs.current[globalIndex] = el;
                              }}
                              onClick={() => {
                                trackEvent('[AIMentions].selectMentionFromDropdown');
                                handleMentionSelect(mention);
                              }}
                              onMouseDown={(e) => e.preventDefault()}
                              className={cn(
                                'cursor-pointer rounded-sm px-2 py-1.5 text-sm transition-colors',
                                isSelected
                                  ? 'bg-accent text-accent-foreground'
                                  : 'hover:bg-accent hover:text-accent-foreground'
                              )}
                            >
                              <div className="flex min-w-0 flex-row items-center gap-1">
                                <div className="flex min-w-0 flex-[3] flex-row items-center gap-2">
                                  {mention.icon && mention.icon}
                                  <span className="truncate font-medium">{mention.label}</span>
                                </div>
                                {hasColumns ? (
                                  <span
                                    className={cn(
                                      'rounded px-1.5 py-0.5 text-[10px] font-medium',
                                      isSelected
                                        ? 'bg-background/50 text-accent-foreground'
                                        : 'bg-muted text-muted-foreground'
                                    )}
                                  >
                                    TAB
                                  </span>
                                ) : (
                                  mention.description && (
                                    <span className="min-w-0 flex-[1] truncate text-right text-xs text-muted-foreground">
                                      {mention.description}
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Column selection dropdown */}
              {showColumnDropdown && mentionState.columnMode && (
                <div
                  data-mentions-dropdown
                  className="absolute z-50 w-72 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                  style={{
                    position: 'fixed',
                    top: mentionState.position.top - 24,
                    left: mentionState.position.left,
                    transform: 'translateY(-100%)',
                    pointerEvents: 'auto',
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                    Columns in {mentionState.columnMode.tableName}
                  </div>
                  <div className="max-h-60 space-y-0.5 overflow-y-auto">
                    {filteredColumns.map((columnName, index) => (
                      <div
                        key={columnName}
                        ref={(el) => {
                          columnItemRefs.current[index] = el;
                        }}
                        onClick={() => {
                          trackEvent('[AIMentions].selectColumnFromDropdown');
                          handleColumnSelect(columnName);
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        className={cn(
                          'cursor-pointer rounded-sm px-2 py-1.5 text-sm transition-colors',
                          index === mentionState.selectedIndex
                            ? 'bg-accent text-accent-foreground'
                            : 'hover:bg-accent hover:text-accent-foreground'
                        )}
                      >
                        <span className="truncate font-medium">{columnName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      );
    }
  )
);

MentionsTextarea.displayName = 'MentionsTextarea';

export { MentionsTextarea };

// Shared mention utilities
export function getMentionCursorPosition(textarea: HTMLTextAreaElement) {
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

  // Calculate position accounting for scroll offset
  const lines = Math.floor(textHeight / lineHeight);
  const top = rect.top + paddingTop + lines * lineHeight - textarea.scrollTop;
  const left = rect.left + paddingLeft;

  return { top, left };
}

export function detectMentionInText(text: string, cursorPos: number) {
  const textBeforeCursor = text.substring(0, cursorPos);
  const atIndex = textBeforeCursor.lastIndexOf('@');
  if (atIndex === -1) return null;

  // Check if there's a space between @ and cursor (not a mention)
  const textBetweenAtAndCursor = textBeforeCursor.substring(atIndex + 1);
  if (textBetweenAtAndCursor.includes(' ')) return null;

  // Check if we're in column mode (has [ or .) - let detectColumnTriggerInText handle this
  if (textBetweenAtAndCursor.includes('[') || textBetweenAtAndCursor.includes('.')) return null;

  // Check if we're at a valid position for a mention
  // A mention is valid if it's at the start of text or has a space before it
  if (atIndex > 0 && textBeforeCursor[atIndex - 1] !== ' ' && textBeforeCursor[atIndex - 1] !== '\n') return null;
  const query = textBetweenAtAndCursor;
  const startIndex = atIndex;
  const endIndex = cursorPos;

  return {
    query,
    startIndex,
    endIndex,
  };
}

/**
 * Detect if user is in column selection mode (typed [ or . after a table mention)
 * Returns null if not in column mode, otherwise returns the column trigger info
 */
export function detectColumnTriggerInText(
  text: string,
  cursorPos: number,
  allMentions: MentionItem[]
): {
  tableName: string;
  columns: MentionColumn[];
  query: string;
  mentionStartIndex: number;
  columnStartIndex: number;
} | null {
  const textBeforeCursor = text.substring(0, cursorPos);
  const atIndex = textBeforeCursor.lastIndexOf('@');
  if (atIndex === -1) return null;

  // Check if we're at a valid position for a mention
  if (atIndex > 0 && textBeforeCursor[atIndex - 1] !== ' ' && textBeforeCursor[atIndex - 1] !== '\n') return null;

  const textAfterAt = textBeforeCursor.substring(atIndex + 1);

  // Check for [ bracket syntax: @TableName[query
  const bracketIndex = textAfterAt.indexOf('[');
  if (bracketIndex !== -1) {
    const tableName = textAfterAt.substring(0, bracketIndex);
    const columnQuery = textAfterAt.substring(bracketIndex + 1);

    // Don't trigger if there's a closing bracket already
    if (columnQuery.includes(']')) return null;

    // Find the mention with this table name
    const mention = allMentions.find((m) => m.value === tableName);
    if (mention?.columns && mention.columns.length > 0) {
      return {
        tableName,
        columns: mention.columns,
        query: columnQuery,
        mentionStartIndex: atIndex,
        columnStartIndex: atIndex + 1 + bracketIndex + 1,
      };
    }
  }

  // Check for dot syntax: @TableName.query
  const dotIndex = textAfterAt.indexOf('.');
  if (dotIndex !== -1 && bracketIndex === -1) {
    const tableName = textAfterAt.substring(0, dotIndex);
    const columnQuery = textAfterAt.substring(dotIndex + 1);

    // Don't trigger if there's a space after the dot (completed mention)
    if (columnQuery.includes(' ')) return null;

    // Find the mention with this table name
    const mention = allMentions.find((m) => m.value === tableName);
    if (mention?.columns && mention.columns.length > 0) {
      return {
        tableName,
        columns: mention.columns,
        query: columnQuery,
        mentionStartIndex: atIndex,
        columnStartIndex: atIndex + 1 + dotIndex + 1,
      };
    }
  }

  return null;
}
