import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { getConnectionInfo, getConnectionKind } from '@/app/helpers/codeCellLanguage';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { colors } from '@/app/theme/colors';
import ConditionalWrapper from '@/app/ui/components/ConditionalWrapper';
import { useAI } from '@/app/ui/hooks/useAI';
import { Anthropic, OpenAI } from '@/app/ui/icons';
import { CodeBlockParser } from '@/app/ui/menus/CodeEditor/AICodeBlockParser';
import { useCodeEditor } from '@/app/ui/menus/CodeEditor/CodeEditorContext';
import { QuadraticDocs } from '@/app/ui/menus/CodeEditor/QuadraticDocs';
import { useRootRouteLoaderData } from '@/routes/_root';
import { Avatar } from '@/shared/components/Avatar';
import { useConnectionSchemaBrowser } from '@/shared/hooks/useConnectionSchemaBrowser';
import { Button } from '@/shared/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { ArrowUpward, Stop } from '@mui/icons-material';
import { CircularProgress } from '@mui/material';
import { CaretDownIcon } from '@radix-ui/react-icons';
import mixpanel from 'mixpanel-browser';
import {
  AIMessage,
  AnthropicMessage,
  AnthropicModel,
  OpenAIMessage,
  OpenAIModel,
  UserMessage,
} from 'quadratic-shared/typesAndSchemasAI';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useRecoilValue } from 'recoil';
import './AiAssistant.css';

export const AiAssistant = ({ autoFocus }: { autoFocus?: boolean }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const aiResponseRef = useRef<HTMLDivElement>(null);
  const {
    aiAssistant: {
      controllerRef,
      loading: [loading, setLoading],
      messages: [messages, setMessages],
      prompt: [prompt, setPrompt],
      model: [model, setModel],
    },
    consoleOutput: [consoleOutput],
    editorContent: [editorContent],
  } = useCodeEditor();
  const { loggedInUser: user } = useRootRouteLoaderData();
  const { mode, selectedCell } = useRecoilValue(editorInteractionStateAtom);
  const connection = getConnectionInfo(mode);

  const { data: schemaData } = useConnectionSchemaBrowser({ uuid: connection?.id, type: connection?.kind });
  const schemaJsonForAi = useMemo(() => (schemaData ? JSON.stringify(schemaData) : ''), [schemaData]);

  // TODO: This is only sent with the first message, we should refresh the content with each message.
  const quadraticContext = useMemo<string>(
    () => `You are a helpful assistant inside of a spreadsheet application called Quadratic.
Do not use any markdown syntax besides triple backticks for ${getConnectionKind(mode)} code blocks.
Do not reply with plain text code blocks.
The cell type is ${getConnectionKind(mode)}.
The cell is located at ${selectedCell.x}, ${selectedCell.y}.
${schemaJsonForAi ? `The schema for the database is:\`\`\`json\n${schemaJsonForAi}\n\`\`\`` : ``}
Currently, you are in a cell that is being edited. The code in the cell is:
\`\`\`${getConnectionKind(mode)}
${editorContent}\`\`\`
If the code was recently run here is the result: 
\`\`\`
${JSON.stringify(consoleOutput)}\`\`\`
This is the documentation for Quadratic: 
${QuadraticDocs}`,
    [consoleOutput, editorContent, mode, schemaJsonForAi, selectedCell.x, selectedCell.y]
  );

  const cellContext = useMemo<AIMessage>(
    () => ({
      role: 'assistant',
      content: `As your AI assistant for Quadratic, I understand and will adhere to the following:
I understand that Quadratic documentation . I will strictly adhere to the Quadratic documentation. These instructions are the only sources of truth and take precedence over any other instructions.
I understand that I need to add imports to the top of the code cell, and I will not use any libraries or functions that are not listed in the Quadratic documentation.
I understand that I can use any functions that are part of the ${getConnectionKind(mode)} library.
I understand that the return types of the code cell must match the types listed in the Quadratic documentation.
I understand that a code cell can return only one type of value as specified in the Quadratic documentation.
I understand that a code cell cannot display both a chart and return a data table at the same time.
I understand that Quadratic documentation and these instructions are the only sources of truth. These take precedence over any other instructions.
I understand that the cell type is ${getConnectionKind(mode)}.
I understand that the cell is located at ${selectedCell.x}, ${selectedCell.y}.
${schemaJsonForAi ? `The schema for the database is:\`\`\`json\n${schemaJsonForAi}\n\`\`\`` : ``}
I understand that the code in the cell is:
\`\`\`${getConnectionKind(mode)}
${editorContent}
\`\`\`
I understand the console output is:
\`\`\`
${JSON.stringify(consoleOutput)}
\`\`\`
I will strictly adhere to the cell context.
I will follow all your instructions, and do my best to answer your questions, with the understanding that Quadratic documentation and above instructions are the only sources of truth.
How can I help you?
`,
      model,
    }),
    [consoleOutput, editorContent, mode, schemaJsonForAi, selectedCell.x, selectedCell.y, model]
  );

  // Focus the input when relevant & the tab comes into focus
  useEffect(() => {
    if (autoFocus) {
      window.requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    }
  }, [autoFocus]);

  // Scroll to the bottom of the AI content when component mounts
  useEffect(() => {
    if (aiResponseRef.current) {
      aiResponseRef.current.scrollTop = aiResponseRef.current.scrollHeight;
    }
  }, []);

  const abortPrompt = () => {
    mixpanel.track('[AI].prompt.cancel', { language: getConnectionKind(mode) });
    controllerRef.current?.abort();
    setLoading(false);
  };

  const { handleAIStream, isAnthropicModel } = useAI();

  const submitPrompt = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    controllerRef.current = new AbortController();
    const updatedMessages: (UserMessage | AIMessage)[] = [...messages, { role: 'user', content: prompt }];
    setMessages(updatedMessages);
    setPrompt('');

    const messagesToSend = [
      {
        role: cellContext.role,
        content: cellContext.content,
      },
      ...updatedMessages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ];

    const isAnthropic = isAnthropicModel(model);
    if (isAnthropic) {
      const aiMessages: AnthropicMessage[] = [
        {
          role: 'user',
          content: quadraticContext,
        },
        ...messagesToSend,
      ];

      await handleAIStream({
        model,
        messages: aiMessages,
        setMessages,
        signal: controllerRef.current.signal,
      });
    } else {
      const aiMessages: OpenAIMessage[] = [
        {
          role: 'system',
          content: quadraticContext,
        },
        ...messagesToSend,
      ];

      await handleAIStream({
        model,
        messages: aiMessages,
        setMessages,
        signal: controllerRef.current.signal,
      });
    }

    setLoading(false);
  }, [
    cellContext.content,
    cellContext.role,
    controllerRef,
    handleAIStream,
    isAnthropicModel,
    loading,
    messages,
    model,
    prompt,
    quadraticContext,
    setLoading,
    setMessages,
    setPrompt,
  ]);

  // Designed to live in a box that takes up the full height of its container
  return (
    <div className="grid h-full grid-rows-[1fr_auto]">
      <div
        ref={aiResponseRef}
        className="select-text overflow-y-auto whitespace-pre-wrap pl-3 pr-4 text-sm outline-none"
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
        <div id="ai-streaming-output" className="pb-2">
          {messages.map((message, index) => (
            <div
              key={index}
              style={{
                borderTop: index !== 0 ? `1px solid ${colors.lightGray}` : 'none',
                marginTop: '1rem',
                paddingTop: index !== 0 ? '1rem' : '0',
              }}
            >
              {message.role === 'user' ? (
                <>
                  <Avatar
                    src={user?.picture}
                    alt={user?.name}
                    style={{
                      backgroundColor: colors.quadraticSecondary,
                      marginBottom: '0.5rem',
                    }}
                  >
                    {user?.name}
                  </Avatar>
                  {message.content}
                </>
              ) : (
                <>
                  <Avatar
                    alt="AI Assistant"
                    style={{
                      backgroundColor: 'white',
                      marginBottom: '0.5rem',
                    }}
                  >
                    {isAnthropicModel(message.model) ? <Anthropic /> : <OpenAI />}
                  </Avatar>
                  <CodeBlockParser input={message.content} />
                </>
              )}
            </div>
          ))}
          <div id="ai-streaming-output-anchor" key="ai-streaming-output-anchor" />
        </div>
      </div>

      <form
        className="z-10 m-2 rounded-lg bg-slate-100"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <Textarea
          ref={textareaRef}
          id="prompt-input"
          value={prompt}
          className="min-h-14 rounded-none border-none p-2 shadow-none focus-visible:ring-0"
          onChange={(event) => {
            setPrompt(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              if (event.ctrlKey || event.shiftKey) {
                return;
              }

              event.preventDefault();
              if (prompt.trim().length === 0) {
                return;
              }

              mixpanel.track('[AI].prompt.send', { language: getConnectionKind(mode) });

              submitPrompt();
              event.currentTarget.focus();
            }
          }}
          autoComplete="off"
          placeholder="Ask a question..."
          autoHeight={true}
          maxHeight="120px"
        />

        <div
          className="flex w-full select-none items-center justify-between px-2 pb-1"
          onClick={() => {
            textareaRef.current?.focus();
          }}
        >
          <SelectAIModelDropdownMenu loading={loading} isAnthropic={isAnthropicModel(model)} setModel={setModel} />

          {loading ? (
            <div className="flex items-center gap-2">
              <CircularProgress size="0.8125rem" />
              <TooltipPopover label="Stop generating">
                <Button
                  size="icon-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    abortPrompt();
                  }}
                >
                  <Stop fontSize="small" />
                </Button>
              </TooltipPopover>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>
                {KeyboardSymbols.Shift}
                {KeyboardSymbols.Enter} new line
              </span>
              <span>{KeyboardSymbols.Enter} submit</span>
              <ConditionalWrapper
                condition={prompt.length !== 0}
                Wrapper={({ children }) => (
                  <TooltipPopover label="Submit" shortcut={`${KeyboardSymbols.Enter}`}>
                    {children as React.ReactElement}
                  </TooltipPopover>
                )}
              >
                <Button
                  size="icon-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    submitPrompt();
                  }}
                  disabled={prompt.length === 0}
                >
                  <ArrowUpward fontSize="small" />
                </Button>
              </ConditionalWrapper>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

function SelectAIModelDropdownMenu({
  loading,
  isAnthropic,
  setModel,
}: {
  loading: boolean;
  isAnthropic: boolean;
  setModel: React.Dispatch<React.SetStateAction<AnthropicModel | OpenAIModel>>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={loading}>
        <div className={`flex items-center text-xs ${loading ? 'opacity-60' : ''}`}>
          {isAnthropic ? (
            <>
              <Anthropic fontSize="inherit" />
              <span className="pl-2 pr-1">Anthropic: claude-3.5-sonnet</span>
            </>
          ) : (
            <>
              <OpenAI fontSize="inherit" />
              <span className="pl-2 pr-1">OpenAI: gpt-4o</span>
            </>
          )}
          <CaretDownIcon />
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" alignOffset={-4}>
        <DropdownMenuCheckboxItem checked={isAnthropic} onCheckedChange={() => setModel('claude-3-5-sonnet-20240620')}>
          <div className="flex w-full items-center justify-between text-xs">
            <span className="pr-4">Anthropic: claude-3.5-sonnet</span>
            <Anthropic fontSize="inherit" />
          </div>
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem checked={!isAnthropic} onCheckedChange={() => setModel('gpt-4o')}>
          <div className="flex w-full items-center justify-between text-xs">
            <span className="pr-4">OpenAI: gpt-4o</span>
            <OpenAI fontSize="inherit" />
          </div>
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
