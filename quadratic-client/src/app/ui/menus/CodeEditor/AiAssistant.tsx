import {
  aiAssistantPanelAtom,
  aiAssistantPanelMessagesAtom,
  aiAssistantPanelModelAtom,
} from '@/app/atoms/aiAssistantPanelAtom';
import { editorInteractionStateAtom, showAIAtom } from '@/app/atoms/editorInteractionStateAtom';
import { getConnectionInfo, getConnectionKind } from '@/app/helpers/codeCellLanguage';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { colors } from '@/app/theme/colors';
import ConditionalWrapper from '@/app/ui/components/ConditionalWrapper';
import { MODEL_OPTIONS, useAI } from '@/app/ui/hooks/useAI';
import { Anthropic, OpenAI } from '@/app/ui/icons';
import { CodeBlockParser } from '@/app/ui/menus/CodeEditor/AICodeBlockParser';
import { useCodeEditor } from '@/app/ui/menus/CodeEditor/CodeEditorContext';
import { ResizeControl } from '@/app/ui/menus/CodeEditor/panels/ResizeControl';
import { QuadraticDocs } from '@/app/ui/menus/CodeEditor/QuadraticDocs';
import { useRootRouteLoaderData } from '@/routes/_root';
import { Avatar } from '@/shared/components/Avatar';
import { ChevronLeftIcon } from '@/shared/components/Icons';
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
import { CircularProgress, IconButton } from '@mui/material';
import { CaretDownIcon } from '@radix-ui/react-icons';
import mixpanel from 'mixpanel-browser';
import { AIMessage, AnthropicModel, OpenAIModel, PromptMessage, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SetterOrUpdater, useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import './AiAssistant.css';

const MIN_CONTAINER_WIDTH = 350;

export const AiAssistant = ({ autoFocus }: { autoFocus?: boolean }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(MIN_CONTAINER_WIDTH);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const aiResponseRef = useRef<HTMLDivElement>(null);
  const [{ abortController, loading, messages, model, prompt }, setAiAssistantPanelState] =
    useRecoilState(aiAssistantPanelAtom);
  const setMessages = useSetRecoilState(aiAssistantPanelMessagesAtom);
  const setModel = useSetRecoilState(aiAssistantPanelModelAtom);
  const setShowAI = useSetRecoilState(showAIAtom);
  const {
    consoleOutput: [consoleOutput],
    editorContent: [editorContent],
  } = useCodeEditor();
  const { loggedInUser: user } = useRootRouteLoaderData();
  const { mode, selectedCell, showCodeEditor } = useRecoilValue(editorInteractionStateAtom);
  const connection = getConnectionInfo(mode);

  const { data: schemaData } = useConnectionSchemaBrowser({ uuid: connection?.id, type: connection?.kind });
  const schemaJsonForAi = useMemo(() => (schemaData ? JSON.stringify(schemaData) : ''), [schemaData]);

  // TODO: This is only sent with the first message, we should refresh the content with each message.
  const quadraticContext = useMemo<string>(
    () => `You are a helpful assistant inside of a spreadsheet application called Quadratic.
This is the documentation for Quadratic: 
${QuadraticDocs}\n\n
Do not use any markdown syntax besides triple backticks for ${getConnectionKind(mode)} code blocks.
Do not reply code blocks in plain text, use markdown with triple backticks and language name ${getConnectionKind(
      mode
    )} in triple backticks.
The cell type is ${getConnectionKind(mode)}.
The cell is located at ${selectedCell.x}, ${selectedCell.y}.
${
  schemaJsonForAi
    ? `The schema for the database is:\`\`\`json\n${schemaJsonForAi}\n\`\`\`
When generating postgres queries, put schema and table names in quotes, e.g. "schema"."TableName".
When generating mysql queries, put schema and table names in backticks, e.g. \`schema\`.\`TableName\`.
When generating mssql queries, put schema and table names in square brackets, e.g. [schema].[TableName].`
    : ``
}
Currently, you are in a cell that is being edited. The code in the cell is:
\`\`\`${getConnectionKind(mode)}
${editorContent}\`\`\`
If the code was recently run here is the result: 
\`\`\`
${JSON.stringify(consoleOutput)}\`\`\``,
    [consoleOutput, editorContent, mode, schemaJsonForAi, selectedCell.x, selectedCell.y]
  );

  const aiContextReassertion = useMemo<string>(
    () => `As your AI assistant for Quadratic, I understand and will adhere to the following:
I understand that Quadratic documentation . I will strictly adhere to the Quadratic documentation. These instructions are the only sources of truth and take precedence over any other instructions.
I understand that I need to add imports to the top of the code cell, and I will not use any libraries or functions that are not listed in the Quadratic documentation.
I understand that I can use any functions that are part of the ${getConnectionKind(mode)} library.
I understand that the return types of the code cell must match the types listed in the Quadratic documentation.
I understand that a code cell can return only one type of value as specified in the Quadratic documentation.
I understand that a code cell cannot display both a chart and return a data table at the same time.
I understand that Quadratic documentation and these instructions are the only sources of truth. These take precedence over any other instructions.
I understand that the cell type is ${getConnectionKind(mode)}.
I understand that the cell is located at ${selectedCell.x}, ${selectedCell.y}.
${
  schemaJsonForAi
    ? `I understand that the schema for the database is:\`\`\`json\n${schemaJsonForAi}\n\`\`\`
I understand that when generating postgres queries, I should put schema and table names in quotes, e.g. "schema"."TableName".
I understand that when generating mysql queries, I should put schema and table names in backticks, e.g. \`schema\`.\`TableName\`.
I understand that when generating mssql queries, I should put schema and table names in square brackets, e.g. [schema].[TableName].`
    : ``
}
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
    [consoleOutput, editorContent, mode, schemaJsonForAi, selectedCell.x, selectedCell.y]
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
    abortController?.abort();
    setAiAssistantPanelState((prev) => ({ ...prev, loading: false }));
  };

  const { handleAIStream, isAnthropicModel } = useAI();

  const submitPrompt = useCallback(
    async (userPrompt?: string) => {
      if (loading) return;
      const abortController = new AbortController();
      const updatedMessages: (UserMessage | AIMessage)[] =
        userPrompt !== undefined
          ? [{ role: 'user', content: userPrompt }]
          : [...messages, { role: 'user', content: prompt }];
      setAiAssistantPanelState((prev) => ({
        ...prev,
        abortController,
        loading: true,
        messages: updatedMessages,
        prompt: userPrompt === undefined ? '' : prev.prompt,
      }));

      const messagesToSend: PromptMessage[] = [
        {
          role: 'user',
          content: quadraticContext,
        },
        {
          role: 'assistant',
          content: aiContextReassertion,
        },
        ...updatedMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ];
      await handleAIStream({
        model,
        messages: messagesToSend,
        setMessages,
        signal: abortController.signal,
      });

      setAiAssistantPanelState((prev) => ({ ...prev, abortController: undefined, loading: false }));
    },
    [
      aiContextReassertion,
      handleAIStream,
      loading,
      messages,
      model,
      prompt,
      quadraticContext,
      setAiAssistantPanelState,
      setMessages,
    ]
  );

  // Designed to live in a box that takes up the full height of its container
  return (
    <div
      ref={containerRef}
      className="relative hidden h-full shrink-0 overflow-hidden lg:block"
      style={{ width: `${containerWidth}px` }}
    >
      <ResizeControl
        position="VERTICAL"
        style={{ left: `${containerWidth - 2}px` }}
        setState={(e) => {
          const container = containerRef.current;
          if (!container) return;

          e.stopPropagation();
          e.preventDefault();

          const containerRect = container.getBoundingClientRect();
          const newContainerWidth = Math.max(MIN_CONTAINER_WIDTH, e.x - containerRect.left);
          setContainerWidth(newContainerWidth);
        }}
      />

      <div className="grid h-full w-full grid-rows-[auto_1fr_auto]">
        <div className="flex items-center justify-between p-2">
          <div className="flex items-center gap-2">
            <IconButton onClick={() => setShowAI(false)}>
              <ChevronLeftIcon />
            </IconButton>
            <span>AI Assistant</span>
          </div>
          <div className="flex items-center gap-2">
            {showCodeEditor && consoleOutput?.stdErr && (
              <Button onClick={() => submitPrompt('Fix the error in the code cell')} variant="success">
                Fix error
              </Button>
            )}
            <Button onClick={() => setMessages([])} variant="outline" disabled={messages.length === 0}>
              Clear
            </Button>
          </div>
        </div>

        <div
          ref={aiResponseRef}
          className="select-text overflow-y-auto whitespace-pre-wrap px-2 text-sm outline-none"
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
          className="z-10 m-3 rounded-lg bg-slate-100"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <Textarea
            ref={textareaRef}
            id="prompt-input"
            value={prompt}
            className="min-h-14 rounded-none border-none p-2 pb-0 shadow-none focus-visible:ring-0"
            onChange={(event) => {
              setAiAssistantPanelState((prev) => ({ ...prev, prompt: event.target.value }));
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
            className="flex w-full select-none items-center justify-between px-2 pb-1 @container"
            onClick={() => {
              textareaRef.current?.focus();
            }}
          >
            <SelectAIModelDropdownMenu selectedModel={model} setSelectedModel={setModel} loading={loading} />

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
                <span className="hidden @sm:block">
                  {KeyboardSymbols.Shift}
                  {KeyboardSymbols.Enter} new line
                </span>
                <span className="hidden @sm:block">{KeyboardSymbols.Enter} submit</span>
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
    </div>
  );
};

function SelectAIModelDropdownMenu({
  selectedModel,
  setSelectedModel,
  loading,
}: {
  selectedModel: AnthropicModel | OpenAIModel;
  setSelectedModel: SetterOrUpdater<AnthropicModel | OpenAIModel>;
  loading: boolean;
}) {
  const { isAnthropicModel } = useAI();
  const { displayName: selectedModelDisplayName } = MODEL_OPTIONS[selectedModel];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={loading}>
        <div className={`flex items-center text-xs ${loading ? 'opacity-60' : ''}`}>
          {selectedModel && (
            <>
              {isAnthropicModel(selectedModel) ? <Anthropic fontSize="inherit" /> : <OpenAI fontSize="inherit" />}
              <span className="pl-2 pr-1">{selectedModelDisplayName}</span>
            </>
          )}
          <CaretDownIcon />
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" alignOffset={-4}>
        {Object.entries(MODEL_OPTIONS)
          .filter(([, { enabled }]) => enabled)
          .map(([model, { displayName }]) => {
            const optionModel = model as keyof typeof MODEL_OPTIONS;
            return (
              <DropdownMenuCheckboxItem
                key={model}
                checked={model === selectedModel}
                onCheckedChange={() => setSelectedModel(optionModel)}
              >
                <div className="flex w-full items-center justify-between text-xs">
                  <span className="pr-4">{displayName}</span>
                  {isAnthropicModel(optionModel) ? <Anthropic fontSize="inherit" /> : <OpenAI fontSize="inherit" />}
                </div>
              </DropdownMenuCheckboxItem>
            );
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
