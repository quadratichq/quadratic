import {
  aiStore,
  currentChatMessagesAtom,
  currentChatMessagesCountAtom,
  currentChatUserMessagesCountAtom,
  loadingAtom,
  pdfImportLoadingAtom,
  promptSuggestionsAtom,
  promptSuggestionsCountAtom,
  promptSuggestionsLoadingAtom,
  waitingOnMessageIndexAtom,
  webSearchLoadingAtom,
} from '@/app/ai/atoms/aiAnalystAtoms';
import { AIToolCardEditable } from '@/app/ai/toolCards/AIToolCardEditable';
import { GroupedCodeToolCards, isCodeTool } from '@/app/ai/toolCards/GroupedCodeToolCards';
import { GroupedFormattingToolCards, isFormattingTool } from '@/app/ai/toolCards/GroupedFormattingToolCards';
import { ToolCardQuery } from '@/app/ai/toolCards/ToolCardQuery';
import { UserPromptSuggestionsSkeleton } from '@/app/ai/toolCards/UserPromptSuggestionsSkeleton';
import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { AILoading } from '@/app/ui/components/AILoading';
import { AIThinkingBlock } from '@/app/ui/components/AIThinkingBlock';
import { GoogleSearchSources } from '@/app/ui/components/GoogleSearchSources';
import { ImportFilesToGrid } from '@/app/ui/components/ImportFilesToGrid';
import { Markdown } from '@/app/ui/components/Markdown';
import { AIAnalystContextLengthError } from '@/app/ui/menus/AIAnalyst/AIAnalystContextLengthError';
import { AIAnalystUserMessageForm } from '@/app/ui/menus/AIAnalyst/AIAnalystUserMessageForm';
import { defaultAIAnalystContext } from '@/app/ui/menus/AIAnalyst/const/defaultAIAnalystContext';
import { useSubmitAIAnalystPrompt } from '@/app/ui/menus/AIAnalyst/hooks/useSubmitAIAnalystPrompt';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/shared/shadcn/ui/hover-card';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useAtom, useAtomValue } from 'jotai';
import {
  createTextContent,
  getUserPromptMessages,
  isContentGoogleSearchInternal,
  isContentImportFilesToGridInternal,
  isContentText,
  isContentThinking,
  isInternalMessage,
  isToolResultMessage,
  isUserPromptMessage,
} from 'quadratic-shared/ai/helpers/message.helper';
import type { AIToolCall, ChatMessage, ToolResultContent } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

type AIAnalystMessagesProps = {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
};

type ToolGroupType = 'code' | 'formatting' | 'other';

function getToolGroupType(toolName: string): ToolGroupType {
  if (isCodeTool(toolName)) return 'code';
  if (isFormattingTool(toolName)) return 'formatting';
  return 'other';
}

export const AIAnalystMessages = memo(({ textareaRef }: AIAnalystMessagesProps) => {
  const { debug, debugFlags } = useDebugFlags();
  const debugShowAIInternalContext = useMemo(() => debugFlags.getFlag('debugShowAIInternalContext'), [debugFlags]);
  const debugAIAnalystChatEditing = useMemo(
    () => (debugFlags.getFlag('debugAIAnalystChatEditing') ? true : undefined),
    [debugFlags]
  );

  const [messages, setMessages] = useAtom(currentChatMessagesAtom);
  const messagesCount = useAtomValue(currentChatMessagesCountAtom);
  const loading = useAtomValue(loadingAtom);

  // Pre-process messages to identify groups of consecutive tool calls across messages
  // Returns a map of messageIndex -> { isGroupStart, groupToolCalls, skipToolCalls, isGroupComplete }
  const toolGroupInfo = useMemo(() => {
    const info = new Map<
      number,
      {
        isGroupStart: boolean;
        groupType: ToolGroupType | null;
        groupToolCalls: AIToolCall[];
        skipToolCalls: boolean;
        isGroupComplete: boolean;
      }
    >();

    let currentGroupStart: number | null = null;
    let currentGroupType: ToolGroupType | null = null;
    let currentGroupToolCalls: AIToolCall[] = [];

    messages.forEach((message, index) => {
      // Skip toolResult and internal context messages - they don't affect grouping
      if (message.role === 'user' && message.contextType === 'toolResult') {
        return;
      }
      if (message.role !== 'assistant' || message.contextType !== 'userPrompt') {
        return;
      }

      // Check if this message has text content (which would end the group)
      const hasTextContent =
        'content' in message &&
        message.content.some((item) => isContentText(item) && (item as { text: string }).text.trim().length > 0);

      // If message has no tool calls but has text, finalize any existing group
      if (message.toolCalls.length === 0) {
        if (hasTextContent && currentGroupStart !== null && currentGroupToolCalls.length > 1) {
          const existing = info.get(currentGroupStart);
          if (existing) {
            existing.groupToolCalls = currentGroupToolCalls;
            existing.isGroupComplete = true; // Group is complete because text followed
          }
          currentGroupStart = null;
          currentGroupType = null;
          currentGroupToolCalls = [];
        }
        return;
      }

      // Check if all tool calls in this message are of the same groupable type
      const firstToolType = getToolGroupType(message.toolCalls[0].name);
      const isGroupableType = firstToolType === 'code' || firstToolType === 'formatting';
      const allSameType =
        isGroupableType && message.toolCalls.every((tc) => getToolGroupType(tc.name) === firstToolType);

      if (allSameType) {
        if (currentGroupType === firstToolType) {
          // Continue the current group
          currentGroupToolCalls.push(...message.toolCalls);
          info.set(index, {
            isGroupStart: false,
            groupType: null,
            groupToolCalls: [],
            skipToolCalls: true,
            isGroupComplete: false,
          });
        } else {
          // Finalize previous group if exists (and mark as complete since a different type came after)
          if (currentGroupStart !== null && currentGroupToolCalls.length > 1) {
            const existing = info.get(currentGroupStart);
            if (existing) {
              existing.groupToolCalls = currentGroupToolCalls;
              existing.isGroupComplete = true; // Group is complete because a different type followed
            }
          }
          // Start a new group
          currentGroupStart = index;
          currentGroupType = firstToolType;
          currentGroupToolCalls = [...message.toolCalls];
          info.set(index, {
            isGroupStart: true,
            groupType: firstToolType,
            groupToolCalls: [],
            skipToolCalls: false,
            isGroupComplete: false,
          });
        }
      } else {
        // Non-groupable tool calls or text content, finalize any existing group (and mark as complete)
        if (currentGroupStart !== null && currentGroupToolCalls.length > 1) {
          const existing = info.get(currentGroupStart);
          if (existing) {
            existing.groupToolCalls = currentGroupToolCalls;
            existing.isGroupComplete = true; // Group is complete because a non-groupable type followed
          }
        }
        currentGroupStart = null;
        currentGroupType = null;
        currentGroupToolCalls = [];
        info.set(index, {
          isGroupStart: false,
          groupType: null,
          groupToolCalls: [],
          skipToolCalls: false,
          isGroupComplete: false,
        });
      }
    });

    // Finalize last group (but don't mark as complete - it might still be growing)
    if (currentGroupStart !== null && currentGroupToolCalls.length > 1) {
      const existing = info.get(currentGroupStart);
      if (existing) {
        existing.groupToolCalls = currentGroupToolCalls;
        // isGroupComplete stays false - the group is at the end and might still grow
      }
    }

    return info;
  }, [messages]);

  const renderToolCalls = useCallback(
    (
      messageIndex: number,
      toolCalls: AIToolCall[],
      debugAIAnalystChatEditing: boolean | undefined,
      messages: ChatMessage[],
      setMessages: (messages: ChatMessage[]) => void
    ) => {
      const groupInfo = toolGroupInfo.get(messageIndex);

      // Skip tool calls if they're part of a group that starts in an earlier message
      if (groupInfo?.skipToolCalls) {
        return null;
      }

      // If this is the start of a cross-message group, render the grouped component
      if (groupInfo?.groupToolCalls && groupInfo.groupToolCalls.length > 1) {
        if (groupInfo.groupType === 'code') {
          return (
            <GroupedCodeToolCards
              toolCalls={groupInfo.groupToolCalls}
              className="tool-card"
              isComplete={groupInfo.isGroupComplete}
            />
          );
        } else if (groupInfo.groupType === 'formatting') {
          return (
            <GroupedFormattingToolCards
              toolCalls={groupInfo.groupToolCalls}
              className="tool-card"
              isComplete={groupInfo.isGroupComplete}
            />
          );
        }
      }

      // Otherwise, render normally (handles single tool calls and non-groupable tools)
      return (
        <GroupedToolCalls
          toolCalls={toolCalls}
          messageIndex={messageIndex}
          debugAIAnalystChatEditing={debugAIAnalystChatEditing}
          messages={messages}
          setMessages={setMessages}
        />
      );
    },
    [toolGroupInfo]
  );

  const waitingOnMessageIndex = useAtomValue(waitingOnMessageIndexAtom);
  const promptSuggestionsCount = useAtomValue(promptSuggestionsCountAtom);
  const promptSuggestionsLoading = useAtomValue(promptSuggestionsLoadingAtom);

  const [div, setDiv] = useState<HTMLDivElement | null>(null);
  const ref = useCallback((div: HTMLDivElement | null) => {
    setDiv(div);
    div?.scrollTo({
      top: div.scrollHeight,
      behavior: 'smooth',
    });
  }, []);

  const shouldAutoScroll = useRef(true);
  const handleScroll = useCallback((e: Event) => {
    const div = e.target as HTMLDivElement;
    // Add a small buffer (5px) to account for rounding errors and tiny scroll differences
    const isScrolledToBottom = div.scrollHeight - div.scrollTop - div.clientHeight < 5;
    shouldAutoScroll.current = isScrolledToBottom;
  }, []);

  useEffect(() => {
    // Use both scroll and scrollend events for better cross-browser support
    div?.addEventListener('scroll', handleScroll);
    div?.addEventListener('scrollend', handleScroll);
    return () => {
      div?.removeEventListener('scroll', handleScroll);
      div?.removeEventListener('scrollend', handleScroll);
    };
  }, [div, handleScroll]);

  const scrollToBottom = useCallback(
    (force = false) => {
      if (force || shouldAutoScroll.current) {
        // Use requestAnimationFrame to ensure scrolling happens in the next frame
        // This helps prevent race conditions with React re-renders
        requestAnimationFrame(() => {
          if (div) {
            div.scrollTo({
              top: div.scrollHeight,
              // Use auto for rapid text updates to avoid falling behind
              // Smooth scrolling can't keep up with fast text generation
              behavior: force ? 'auto' : 'smooth',
            });
          }
        });
      }
    },
    [div]
  );

  useEffect(() => {
    if (loading) {
      // Don't force shouldAutoScroll to true - respect current value
      // Only force initial scroll if already at bottom
      if (shouldAutoScroll.current) {
        scrollToBottom(true);
      }

      // Only observe mutations while loading
      if (div) {
        const observer = new MutationObserver(() => {
          // Only scroll if user was already at bottom
          if (shouldAutoScroll.current) {
            scrollToBottom(true);
          }
        });

        observer.observe(div, {
          childList: true,
          subtree: true,
          characterData: true,
        });

        return () => observer.disconnect();
      }
    }
  }, [loading, scrollToBottom, div]);

  useEffect(() => {
    if (messagesCount === 0) {
      shouldAutoScroll.current = true;
    }
  }, [messagesCount]);

  // Only scroll on message changes if we're loading and user was already at bottom
  useEffect(() => {
    if (loading && shouldAutoScroll.current) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom, loading, shouldAutoScroll]);

  // Scroll to bottom when prompt suggestions are available
  useEffect(() => {
    if (promptSuggestionsCount > 0) {
      scrollToBottom();
    }
  }, [promptSuggestionsCount, scrollToBottom]);

  if (messagesCount === 0) {
    // Return an empty placeholder to maintain grid layout structure
    // This ensures the form stays at the bottom in the correct grid row
    return <div />;
  }

  return (
    <div
      ref={ref}
      className="flex select-text flex-col gap-2 overflow-y-auto px-2 pb-8 outline-none"
      spellCheck={false}
      onKeyDown={(e) => {
        if (((e.metaKey || e.ctrlKey) && e.key === 'a') || ((e.metaKey || e.ctrlKey) && e.key === 'c')) {
          // Allow a few commands, but nothing else
        } else {
          e.preventDefault();
        }
      }}
      // Disable Grammarly
      data-gramm="false"
      data-gramm_editor="false"
      data-enable-grammarly="false"
    >
      {messages.map((message, index) => {
        if (
          !debugShowAIInternalContext &&
          !['userPrompt', 'webSearchInternal', 'importFilesToGrid'].includes(message.contextType)
        ) {
          return null;
        }

        // Check if this message's tool calls are being skipped as part of a group
        const groupInfo = toolGroupInfo.get(index);
        const toolCallsSkipped = groupInfo?.skipToolCalls === true;

        // If tool calls are skipped and message has no visible content, skip the entire message
        if (
          toolCallsSkipped &&
          message.role === 'assistant' &&
          'content' in message &&
          message.content.every((item) => !isContentText(item) || !item.text.trim())
        ) {
          return null;
        }

        const isCurrentMessage = index === messagesCount - 1;
        const modelKey = 'modelKey' in message ? message.modelKey : undefined;

        return (
          <div
            key={`${index}-${message.role}-${message.contextType}-${message.content}`}
            className={cn(
              'flex flex-col gap-2',
              message.role === 'assistant' ? 'px-2' : '',
              // For debugging internal context
              ['userPrompt', 'webSearchInternal', 'importFilesToGrid'].includes(message.contextType)
                ? ''
                : 'rounded-lg bg-gray-500 p-2'
            )}
          >
            {debug && !!modelKey && <span className="text-xs text-muted-foreground">{modelKey}</span>}

            {isInternalMessage(message) ? (
              isContentGoogleSearchInternal(message.content) ? (
                <GoogleSearchSources content={message.content} />
              ) : isContentImportFilesToGridInternal(message.content) ? (
                <ImportFilesToGrid content={message.content} />
              ) : null
            ) : isUserPromptMessage(message) ? (
              <AIAnalystUserMessageForm
                initialContent={message.content}
                initialContext={message.context}
                textareaRef={textareaRef}
                messageIndex={index}
                onContentChange={
                  debugAIAnalystChatEditing &&
                  ((content) => {
                    const newMessages = [...messages];
                    newMessages[index] = { ...message, content };
                    setMessages(newMessages);
                  })
                }
                uiContext="analyst-edit-chat"
              />
            ) : isToolResultMessage(message) ? (
              message.content.map((result, resultIndex) => (
                <AIAnalystUserMessageForm
                  key={`${index}-${result.id}`}
                  initialContent={result.content}
                  textareaRef={textareaRef}
                  messageIndex={index}
                  onContentChange={
                    debugAIAnalystChatEditing &&
                    ((content) => {
                      const newMessages = [...messages];
                      newMessages[index] = { ...message, content: [...message.content] };
                      newMessages[index].content[resultIndex] = {
                        ...result,
                        content: content as ToolResultContent,
                      };
                      setMessages(newMessages);
                    })
                  }
                  uiContext="analyst-edit-chat"
                />
              ))
            ) : (
              <>
                {/* Check for context length error and render special component */}
                {'errorType' in message && message.errorType === 'context_length' ? (
                  <AIAnalystContextLengthError
                    message={
                      message.content.find(isContentText)?.text ??
                      "Your conversation is too long for the AI model's context window."
                    }
                  />
                ) : (
                  message.content.map((item, contentIndex) =>
                    isContentThinking(item) ? (
                      <AIThinkingBlock
                        key={`${index}-${contentIndex}-${item.type}`}
                        isCurrentMessage={isCurrentMessage && contentIndex === message.content.length - 1}
                        isLoading={loading}
                        thinkingContent={item}
                        onContentChange={
                          debugAIAnalystChatEditing &&
                          ((newItem) => {
                            const newMessage = { ...message, content: [...message.content] };
                            newMessage.content[contentIndex] = newItem;
                            const newMessages = [...messages];
                            (newMessages as typeof messages)[index] = newMessage as typeof message;
                            setMessages(newMessages);
                          })
                        }
                      />
                    ) : isContentText(item) ? (
                      <Markdown
                        key={`${index}-${contentIndex}-${item.type}`}
                        text={item.text}
                        onChange={
                          debugAIAnalystChatEditing &&
                          ((text) => {
                            const newMessage = { ...message, content: [...message.content] };
                            newMessage.content[contentIndex] = { ...item, text };
                            const newMessages = [...messages];
                            (newMessages as typeof messages)[index] = newMessage as typeof message;
                            setMessages(newMessages);
                          })
                        }
                      />
                    ) : null
                  )
                )}

                {message.contextType === 'userPrompt' &&
                  renderToolCalls(index, message.toolCalls, debugAIAnalystChatEditing, messages, setMessages)}
              </>
            )}
          </div>
        );
      })}

      {messagesCount > 1 && !loading && waitingOnMessageIndex === undefined && <PromptSuggestions />}

      <PDFImportLoading />

      <WebSearchLoading />

      <UserPromptSuggestionsSkeleton
        toolCall={{
          id: 'user_prompt_suggestions',
          name: 'UserPromptSuggestions',
          arguments: '',
          loading: promptSuggestionsLoading,
        }}
        className="tool-card"
      />

      <AILoading loading={loading} />
    </div>
  );
});

const PromptSuggestions = memo(() => {
  const { submitPrompt } = useSubmitAIAnalystPrompt();
  const handleClick = useCallback(
    (prompt: string) => {
      const userMessagesCount = aiStore.get(currentChatUserMessagesCountAtom);
      trackEvent('[AIAnalyst].submitPromptSuggestion', { userMessageCountUponSubmit: userMessagesCount });

      const messages = aiStore.get(currentChatMessagesAtom);
      const lastContext = getUserPromptMessages(messages).at(-1)?.context;
      submitPrompt({
        messageSource: 'User',
        content: [createTextContent(prompt)],
        context: {
          ...(lastContext ? { codeCell: lastContext.codeCell } : defaultAIAnalystContext),
        },
        messageIndex: messages.length,
        importFiles: [],
      });
    },
    [submitPrompt]
  );

  const promptSuggestions = useAtomValue(promptSuggestionsAtom);
  const messagesCount = useAtomValue(currentChatMessagesCountAtom);
  if (!messagesCount || !promptSuggestions.suggestions.length) {
    return null;
  }

  return (
    <div className="flex flex-row flex-wrap gap-2 px-2">
      {promptSuggestions.suggestions.map((suggestion, index) => (
        <HoverCard key={`${index}-${suggestion.label}-card`}>
          <HoverCardTrigger asChild>
            <div
              className="flex h-7 cursor-pointer items-center justify-between rounded-md bg-accent p-2 text-sm hover:bg-accent/80"
              onClick={() => handleClick(suggestion.prompt)}
            >
              <span className="truncate">{suggestion.label}</span>
            </div>
          </HoverCardTrigger>
          <HoverCardContent side="top" align="start">
            <p className="text-sm">{suggestion.prompt}</p>
          </HoverCardContent>
        </HoverCard>
      ))}
    </div>
  );
});

const PDFImportLoading = memo(() => {
  const pdfImportLoading = useAtomValue(pdfImportLoadingAtom);

  if (!pdfImportLoading) {
    return null;
  }

  return (
    <ToolCardQuery
      className="px-2"
      label="Reading file. Large files may take a few minutes."
      isLoading={pdfImportLoading}
    />
  );
});

const WebSearchLoading = memo(() => {
  const webSearchLoading = useAtomValue(webSearchLoadingAtom);

  if (!webSearchLoading) {
    return null;
  }

  return <ToolCardQuery className="px-2" label="Searching the web." isLoading={webSearchLoading} />;
});

// Helper component to group consecutive code tool calls
interface GroupedToolCallsProps {
  toolCalls: AIToolCall[];
  messageIndex: number;
  debugAIAnalystChatEditing: boolean | undefined;
  messages: ChatMessage[];
  setMessages: (messages: ChatMessage[]) => void;
}

const GroupedToolCalls = memo(
  ({ toolCalls, messageIndex, debugAIAnalystChatEditing, messages, setMessages }: GroupedToolCallsProps) => {
    // Group consecutive tools of the same type together
    const groupedItems: Array<{ type: ToolGroupType; toolCalls: AIToolCall[]; startIndex: number }> = [];

    let currentGroup: { type: ToolGroupType; toolCalls: AIToolCall[]; startIndex: number } | null = null;

    toolCalls.forEach((toolCall, idx) => {
      const groupType = getToolGroupType(toolCall.name);

      if (!currentGroup || currentGroup.type !== groupType) {
        if (currentGroup) {
          groupedItems.push(currentGroup);
        }
        currentGroup = { type: groupType, toolCalls: [toolCall], startIndex: idx };
      } else {
        currentGroup.toolCalls.push(toolCall);
      }
    });

    if (currentGroup) {
      groupedItems.push(currentGroup);
    }

    return (
      <>
        {groupedItems.map((group, groupIdx) => {
          // Render grouped code tools
          if (group.type === 'code' && group.toolCalls.length > 1) {
            return (
              <GroupedCodeToolCards
                key={`group-code-${messageIndex}-${groupIdx}`}
                toolCalls={group.toolCalls}
                className="tool-card"
              />
            );
          }

          // Render grouped formatting tools
          if (group.type === 'formatting' && group.toolCalls.length > 1) {
            return (
              <GroupedFormattingToolCards
                key={`group-formatting-${messageIndex}-${groupIdx}`}
                toolCalls={group.toolCalls}
                className="tool-card"
              />
            );
          }

          // Render individual tool cards
          return group.toolCalls.map((toolCall, idx) => {
            const toolCallIndex = group.startIndex + idx;
            return (
              <AIToolCardEditable
                key={`${messageIndex}-${toolCallIndex}-${toolCall.id}-${toolCall.name}`}
                toolCall={toolCall}
                onToolCallChange={
                  debugAIAnalystChatEditing
                    ? (newToolCall) => {
                        const message = messages[messageIndex];
                        if (!('toolCalls' in message)) return;
                        const newMessage = { ...message, toolCalls: [...message.toolCalls] };
                        newMessage.toolCalls[toolCallIndex] = newToolCall;
                        const newMessages = [...messages];
                        newMessages[messageIndex] = newMessage;
                        setMessages(newMessages);
                      }
                    : undefined
                }
              />
            );
          });
        })}
      </>
    );
  }
);
