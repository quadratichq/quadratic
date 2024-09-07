import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { getConnectionInfo, getConnectionKind } from '@/app/helpers/codeCellLanguage';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { colors } from '@/app/theme/colors';
import ConditionalWrapper from '@/app/ui/components/ConditionalWrapper';
import { TooltipHint } from '@/app/ui/components/TooltipHint';
import { useAI } from '@/app/ui/hooks/useAI';
import { AI } from '@/app/ui/icons';
import { useCodeEditor } from '@/app/ui/menus/CodeEditor/CodeEditorContext';
import { QuadraticDocs } from '@/app/ui/menus/CodeEditor/QuadraticDocs';
import { useRootRouteLoaderData } from '@/routes/_root';
import { Avatar } from '@/shared/components/Avatar';
import { useConnectionSchemaBrowser } from '@/shared/hooks/useConnectionSchemaBrowser';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { Send, Stop } from '@mui/icons-material';
import { CircularProgress, IconButton } from '@mui/material';
import mixpanel from 'mixpanel-browser';
import { AIMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useRecoilValue } from 'recoil';

import { CodeBlockParser } from '@/app/ui/menus/CodeEditor/AICodeBlockParser';
import './AiAssistant.css';

export type AiMessage = {
  role: 'user' | 'system' | 'assistant';
  content: string;
};

export const AiAssistant = ({ autoFocus }: { autoFocus?: boolean }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const aiResponseRef = useRef<HTMLDivElement>(null);
  const {
    aiAssistant: {
      prompt: [prompt, setPrompt],
      loading: [loading, setLoading],
      messages: [messages, setMessages],
      controllerRef,
    },
    consoleOutput: [consoleOutput],
    editorContent: [editorContent],
  } = useCodeEditor();
  const { loggedInUser: user } = useRootRouteLoaderData();
  const { mode, selectedCell } = useRecoilValue(editorInteractionStateAtom);
  const connection = getConnectionInfo(mode);

  const { data: schemaData } = useConnectionSchemaBrowser({ uuid: connection?.id, type: connection?.kind });
  const schemaJsonForAi = schemaData ? JSON.stringify(schemaData) : '';

  // TODO: This is only sent with the first message, we should refresh the content with each message.
  const systemMessages = useMemo<AIMessage[]>(
    () => [
      {
        role: 'system',
        content: `
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
      },
    ],
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
    controllerRef.current?.abort();
    setLoading(false);
  };

  const handleAIStream = useAI();
  const submitPrompt = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    controllerRef.current = new AbortController();

    const updatedMessages: AIMessage[] = [...messages, { role: 'user', content: prompt }];
    setMessages(updatedMessages);
    setPrompt('');

    await handleAIStream({
      model: 'gpt-4o',
      systemMessages,
      messages: updatedMessages,
      setMessages,
      signal: controllerRef.current.signal,
    });

    setLoading(false);
  }, [controllerRef, handleAIStream, loading, messages, prompt, setLoading, setMessages, setPrompt, systemMessages]);

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
