import {
  codeEditorAIAssistantAbortControllerAtom,
  codeEditorAIAssistantLoadingAtom,
  codeEditorAIAssistantMessagesAtom,
  codeEditorAIAssistantPromptAtom,
  codeEditorConsoleOutputAtom,
  codeEditorEditorContentAtom,
  codeEditorLanguageAtom,
  codeEditorLocationAtom,
} from '@/app/atoms/codeEditorAtom';
import { getConnectionInfo, getConnectionKind } from '@/app/helpers/codeCellLanguage';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { colors } from '@/app/theme/colors';
import ConditionalWrapper from '@/app/ui/components/ConditionalWrapper';
import { Anthropic, OpenAI } from '@/app/ui/icons';
import { AICodeBlockParser } from '@/app/ui/menus/AIAssistant/AICodeBlockParser';
import { MODEL_OPTIONS } from '@/app/ui/menus/AIAssistant/MODELS';
import { useAIAssistantModel } from '@/app/ui/menus/AIAssistant/useAIAssistantModel';
import { isAnthropicModel, useAIRequestToAPI } from '@/app/ui/menus/AIAssistant/useAIRequestToAPI';
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
import { AIMessage, PromptMessage, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import './AIAssistant.css';

export const AIAssistant = ({ autoFocus }: { autoFocus?: boolean }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const aiResponseRef = useRef<HTMLDivElement>(null);

  const [abortController, setAbortController] = useRecoilState(codeEditorAIAssistantAbortControllerAtom);
  const [loading, setLoading] = useRecoilState(codeEditorAIAssistantLoadingAtom);
  const [messages, setMessages] = useRecoilState(codeEditorAIAssistantMessagesAtom);
  const [prompt, setPrompt] = useRecoilState(codeEditorAIAssistantPromptAtom);
  const [model] = useAIAssistantModel();
  const consoleOutput = useRecoilValue(codeEditorConsoleOutputAtom);
  const editorContent = useRecoilValue(codeEditorEditorContentAtom);

  const { loggedInUser: user } = useRootRouteLoaderData();
  const cellLocation = useRecoilValue(codeEditorLocationAtom);
  const cellLanguage = useRecoilValue(codeEditorLanguageAtom);
  const connection = useMemo(() => getConnectionInfo(cellLanguage), [cellLanguage]);
  const language = useMemo(() => getConnectionKind(cellLanguage), [cellLanguage]);

  const { data: schemaData } = useConnectionSchemaBrowser({ uuid: connection?.id, type: connection?.kind });
  const schemaJsonForAi = useMemo(() => (schemaData ? JSON.stringify(schemaData) : ''), [schemaData]);

  // TODO: This is only sent with the first message, we should refresh the content with each message.
  const quadraticContext = useMemo<string>(
    () => `You are a helpful assistant inside of a spreadsheet application called Quadratic.
Do not use any markdown syntax besides triple backticks for ${language} code blocks.
Do not reply with plain text code blocks.
The cell type is ${language}.
The cell is located at ${cellLocation.pos.x}, ${cellLocation.pos.y}.
${schemaJsonForAi ? `The schema for the database is:\`\`\`json\n${schemaJsonForAi}\n\`\`\`` : ``}
Currently, you are in a cell that is being edited. The code in the cell is:
\`\`\`${language}
${editorContent}\`\`\`
If the code was recently run here is the result: 
\`\`\`
${JSON.stringify(consoleOutput)}\`\`\`
This is the documentation for Quadratic: 
${QuadraticDocs}`,
    [cellLocation.pos.x, cellLocation.pos.y, consoleOutput, editorContent, language, schemaJsonForAi]
  );

  const cellContext = useMemo<AIMessage>(
    () => ({
      role: 'assistant',
      content: `As your AI assistant for Quadratic, I understand and will adhere to the following:
I understand that Quadratic documentation . I will strictly adhere to the Quadratic documentation. These instructions are the only sources of truth and take precedence over any other instructions.
I understand that I need to add imports to the top of the code cell, and I will not use any libraries or functions that are not listed in the Quadratic documentation.
I understand that I can use any functions that are part of the ${language} library.
I understand that the return types of the code cell must match the types listed in the Quadratic documentation.
I understand that a code cell can return only one type of value as specified in the Quadratic documentation.
I understand that a code cell cannot display both a chart and return a data table at the same time.
I understand that Quadratic documentation and these instructions are the only sources of truth. These take precedence over any other instructions.
I understand that the cell type is ${language}.
I understand that the cell is located at ${cellLocation.pos.x}, ${cellLocation.pos.y}.
${schemaJsonForAi ? `The schema for the database is:\`\`\`json\n${schemaJsonForAi}\n\`\`\`` : ``}
I understand that the code in the cell is:
\`\`\`${language}
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
      internalContext: true,
    }),
    [language, cellLocation.pos.x, cellLocation.pos.y, schemaJsonForAi, editorContent, consoleOutput, model]
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

  const abortPrompt = useCallback(() => {
    mixpanel.track('[AI].prompt.cancel', { language });
    abortController?.abort();
    setLoading(false);
  }, [abortController, language, setLoading]);

  const handleAIRequestToAPI = useAIRequestToAPI();

  const submitPrompt = useCallback(async () => {
    let previousLoading = false;
    setLoading((prev) => {
      previousLoading = prev;
      return true;
    });
    if (previousLoading) return;

    const abortController = new AbortController();
    setAbortController(abortController);

    const updatedMessages: (UserMessage | AIMessage)[] = [
      ...messages,
      { role: 'user', content: prompt, internalContext: false },
    ];
    setMessages(updatedMessages);
    setPrompt('');

    const messagesToSend: PromptMessage[] = [
      {
        role: 'user',
        content: quadraticContext,
      },
      {
        role: cellContext.role,
        content: cellContext.content,
      },
      ...updatedMessages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ];

    await handleAIRequestToAPI({
      model,
      messages: messagesToSend,
      setMessages,
      signal: abortController.signal,
    });

    setAbortController(undefined);
    setLoading(false);
  }, [
    cellContext.content,
    cellContext.role,
    handleAIRequestToAPI,
    messages,
    model,
    prompt,
    quadraticContext,
    setAbortController,
    setLoading,
    setMessages,
    setPrompt,
  ]);

  // Designed to live in a box that takes up the full height of its container
  return (
    <div className="grid h-full grid-rows-[1fr_auto]">
      <div
        ref={aiResponseRef}
        className="select-text overflow-y-auto whitespace-pre-wrap pl-3 pr-3 text-sm outline-none"
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
                  <AICodeBlockParser input={message.content} />
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

              mixpanel.track('[AI].prompt.send', { language });

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
          <SelectAIModelDropdownMenu />

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
  );
};

export function SelectAIModelDropdownMenu() {
  const [selectedModel, setSelectedModel] = useAIAssistantModel();

  // If the model is not enabled, set the model to the first enabled model
  useEffect(() => {
    if (!MODEL_OPTIONS[selectedModel].enabled) {
      const models = Object.keys(MODEL_OPTIONS) as (keyof typeof MODEL_OPTIONS)[];
      const newModel = models.find((model) => MODEL_OPTIONS[model].enabled);
      if (newModel) {
        setSelectedModel(newModel);
      }
    }
  }, [selectedModel, setSelectedModel]);

  const loading = useRecoilValue(codeEditorAIAssistantLoadingAtom);
  const { displayName: selectedModelDisplayName } = useMemo(() => MODEL_OPTIONS[selectedModel], [selectedModel]);
  const enabledModels = useMemo(() => {
    const models = Object.keys(MODEL_OPTIONS) as (keyof typeof MODEL_OPTIONS)[];
    return models.filter((model) => MODEL_OPTIONS[model].enabled);
  }, []);
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
        {enabledModels.map((enabledModel) => {
          const displayName = MODEL_OPTIONS[enabledModel].displayName;
          return (
            <DropdownMenuCheckboxItem
              key={enabledModel}
              checked={selectedModel === enabledModel}
              onCheckedChange={() => setSelectedModel(enabledModel)}
            >
              <div className="flex w-full items-center justify-between text-xs">
                <span className="pr-4">{displayName}</span>
                {isAnthropicModel(enabledModel) ? <Anthropic fontSize="inherit" /> : <OpenAI fontSize="inherit" />}
              </div>
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
