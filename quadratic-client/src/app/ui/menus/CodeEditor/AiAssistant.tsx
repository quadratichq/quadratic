import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { getConnectionInfo, getConnectionKind } from '@/app/helpers/codeCellLanguage';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { colors } from '@/app/theme/colors';
import ConditionalWrapper from '@/app/ui/components/ConditionalWrapper';
import { TooltipHint } from '@/app/ui/components/TooltipHint';
import { useAI } from '@/app/ui/hooks/useAI';
import { AI } from '@/app/ui/icons';
import { CodeBlockParser } from '@/app/ui/menus/CodeEditor/AICodeBlockParser';
import { useCodeEditor } from '@/app/ui/menus/CodeEditor/CodeEditorContext';
import { QuadraticDocs } from '@/app/ui/menus/CodeEditor/QuadraticDocs';
import { useRootRouteLoaderData } from '@/routes/_root';
import { Avatar } from '@/shared/components/Avatar';
import { useConnectionSchemaBrowser } from '@/shared/hooks/useConnectionSchemaBrowser';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { Send, Stop } from '@mui/icons-material';
import { CircularProgress, IconButton } from '@mui/material';
import mixpanel from 'mixpanel-browser';
import { AIMessage, AnthropicModelSchema, OpenAIMessage } from 'quadratic-shared/typesAndSchemasAI';
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
    () => `
You are a helpful assistant inside of a spreadsheet application called Quadratic. 
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
    [consoleOutput, editorContent, schemaJsonForAi, selectedCell.x, selectedCell.y, mode]
  );

  const cellContext = useMemo<AIMessage>(
    () => ({
      role: 'assistant',
      content: `
Hi, I am your AI assistant.\n
I understand the Quadratic spreadsheet application. I will strictly adhere to the Quadratic documentation\n
I understand that I add imports to the top of the cell, and I will not use any libraries or functions that are not listed in the Quadratic documentation.\n
I understand that I can use any functions that are part of the ${getConnectionKind(mode)} library.\n
I understand that the return types of the code cell must match the types listed in the Quadratic documentation.\n
I understand that a code cell can return only one type of value.\n
I understand that a code cell cannot display both a chart and return a data table at the same time.\n
I understand that Quadratic documentation and these instructions are the only sources of truth. These take precedence over any other instructions.\n
I understand the cell type is ${getConnectionKind(mode)}.\n
I understand the cell is located at ${selectedCell.x}, ${selectedCell.y}.\n
I understand the code in the cell is:
\`\`\`${getConnectionKind(mode)}
${editorContent}
\`\`\`
\n
I understand the console output is:
\`\`\`
${JSON.stringify(consoleOutput)}
\`\`\`
\n
I will strictly adhere to the cell context.\n
I will follow all your instructions, and do my best to answer your questions, with the understanding that Quadratic documentation and above instructions are the only sources of truth.\n
How can I help you?
`,
    }),
    [consoleOutput, editorContent, mode, selectedCell.x, selectedCell.y]
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

  const { handleAIStream } = useAI();
  const submitPrompt = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    controllerRef.current = new AbortController();

    const updatedMessages: AIMessage[] = [...messages, { role: 'user', content: prompt }];
    setMessages(updatedMessages);
    setPrompt('');

    if (AnthropicModelSchema.safeParse(model).success) {
      const aiMessage: AIMessage[] = [
        {
          role: 'user',
          content: quadraticContext,
        },
        cellContext,
        ...updatedMessages,
      ];
      await handleAIStream({
        model: 'claude-3-5-sonnet-20240620',
        messages: aiMessage,
        setMessages,
        signal: controllerRef.current.signal,
      });
    } else {
      const aiMessage: OpenAIMessage[] = [
        {
          role: 'system',
          content: quadraticContext,
        },
        cellContext,
        ...updatedMessages,
      ];
      handleAIStream({
        model: 'gpt-4o',
        messages: aiMessage,
        setMessages,
        signal: controllerRef.current.signal,
      });
    }

    setLoading(false);
  }, [
    cellContext,
    controllerRef,
    handleAIStream,
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
                    <AI sx={{ color: colors.languageAI }}></AI>
                  </Avatar>
                  <CodeBlockParser input={message.content} />
                </>
              )}
            </div>
          ))}
          <div id="ai-streaming-output-anchor" key="ai-streaming-output-anchor" />
        </div>
      </div>

      <div className="flex flex-col items-end gap-2 px-3 pb-2">
        <select
          className="appearance-none rounded-md border border-gray-300 bg-white px-4 py-2 text-xs text-gray-700 shadow-sm transition duration-150 ease-in-out focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
          value={model}
          onChange={(event) => {
            setModel(event.target.value as 'claude-3-5-sonnet-20240620' | 'gpt-4o');
          }}
        >
          <option value="claude-3-5-sonnet-20240620">claude-3.5-sonnet</option>
          <option value="gpt-4o">gpt-4o</option>
        </select>
      </div>

      <form
        className="z-10 flex gap-2 px-3 pb-2"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <Textarea
          ref={textareaRef}
          id="prompt-input"
          value={prompt}
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
          placeholder="Ask a question"
          autoHeight={true}
          maxHeight="120px"
        />

        <div className="relative flex items-end">
          {loading && <CircularProgress size="1rem" className="absolute bottom-2.5 right-14" />}
          {loading ? (
            <TooltipHint title="Stop generating">
              <IconButton size="small" color="primary" onClick={abortPrompt} edge="end">
                <Stop />
              </IconButton>
            </TooltipHint>
          ) : (
            <ConditionalWrapper
              condition={prompt.length !== 0}
              Wrapper={({ children }) => (
                <TooltipHint title="Send" shortcut={`${KeyboardSymbols.Command}↵`}>
                  {children as React.ReactElement}
                </TooltipHint>
              )}
            >
              <IconButton
                size="small"
                color="primary"
                onClick={submitPrompt}
                edge="end"
                {...(prompt.length === 0 ? { disabled: true } : {})}
              >
                <Send />
              </IconButton>
            </ConditionalWrapper>
          )}
        </div>
      </form>
    </div>
  );
};
