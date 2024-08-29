import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { getConnectionInfo, getConnectionKind } from '@/app/helpers/codeCellLanguage';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { colors } from '@/app/theme/colors';
import ConditionalWrapper from '@/app/ui/components/ConditionalWrapper';
import { TooltipHint } from '@/app/ui/components/TooltipHint';
import { AI } from '@/app/ui/icons';
import { useCodeEditor } from '@/app/ui/menus/CodeEditor/CodeEditorContext';
import { authClient } from '@/auth/auth';
import { useRootRouteLoaderData } from '@/routes/_root';
import { apiClient } from '@/shared/api/apiClient';
import { Avatar } from '@/shared/components/Avatar';
import { useConnectionSchemaBrowser } from '@/shared/hooks/useConnectionSchemaBrowser';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { Send, Stop } from '@mui/icons-material';
import { CircularProgress, IconButton } from '@mui/material';
import mixpanel from 'mixpanel-browser';
import { useEffect, useRef } from 'react';
import { useRecoilValue } from 'recoil';
import { CodeBlockParser } from './AICodeBlockParser';
import './AiAssistant.css';
import { QuadraticDocs } from './QuadraticDocs';

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
  const systemMessages = [
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
  ] as AiMessage[];

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

  const submitPrompt = async () => {
    if (loading) return;
    controllerRef.current = new AbortController();
    setLoading(true);
    const token = await authClient.getTokenOrRedirect();
    const updatedMessages = [...messages, { role: 'user', content: prompt }] as AiMessage[];
    const request_body = {
      model: 'gpt-4o',
      messages: [...systemMessages, ...updatedMessages],
    };
    setMessages(updatedMessages);
    setPrompt('');

    await fetch(`${apiClient.getApiUrl()}/ai/chat/stream`, {
      method: 'POST',
      signal: controllerRef.current.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request_body),
    })
      .then((response) => {
        if (response.status !== 200) {
          if (response.status === 429) {
            setMessages((old) => [
              ...old,
              {
                role: 'assistant',
                content: 'You have exceeded the maximum number of requests. Please try again later.',
              },
            ]);
          } else {
            setMessages((old) => [
              ...old,
              {
                role: 'assistant',
                content: 'Looks like there was a problem. Status Code: ' + response.status,
              },
            ]);
            console.error(`error retrieving data from AI API: ${response.status}`);
          }
          return;
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        let responseMessage = {
          role: 'assistant',
          content: '',
        } as AiMessage;
        setMessages((old) => [...old, responseMessage]);

        return reader?.read().then(function processResult(result): any {
          buffer += decoder.decode(result.value || new Uint8Array(), { stream: !result.done });
          const parts = buffer.split('\n');
          buffer = parts.pop() || '';
          for (const part of parts) {
            const message = part.replace(/^data: /, '');
            try {
              const data = JSON.parse(message);

              // Do something with the JSON data here
              if (data.choices[0].delta.content !== undefined) {
                responseMessage.content += data.choices[0].delta.content;
                setMessages((old) => {
                  old.pop();
                  old.push(responseMessage);
                  return [...old];
                });
              }
            } catch (err) {
              // Not JSON, nothing to do.
            }
          }
          if (result.done) {
            // stream complete
            return;
          }
          return reader.read().then(processResult);
        });
      })
      .catch((err) => {
        // not sure what would cause this to happen
        if (err.name !== 'AbortError') {
          console.log(err);
          return;
        }
      });
    // eslint-disable-next-line no-unreachable

    setLoading(false);
  };

  const displayMessages = messages.filter((message, index) => message.role !== 'system');

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
          {displayMessages.map((message, index) => (
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
