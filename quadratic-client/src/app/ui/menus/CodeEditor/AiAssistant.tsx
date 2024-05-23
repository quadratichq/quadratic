import { EditorInteractionState } from '@/app/atoms/editorInteractionStateAtom';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { colors } from '@/app/theme/colors';
import ConditionalWrapper from '@/app/ui/components/ConditionalWrapper';
import { TooltipHint } from '@/app/ui/components/TooltipHint';
import { AI } from '@/app/ui/icons';
import { authClient } from '@/auth';
import { useRootRouteLoaderData } from '@/routes/index';
import { apiClient } from '@/shared/api/apiClient';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { Send, Stop } from '@mui/icons-material';
import { Avatar, CircularProgress, IconButton } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { CodeBlockParser } from './AICodeBlockParser';
import './AiAssistant.css';
import { QuadraticDocs } from './QuadraticDocs';

// todo: fix types

interface Props {
  editorMode: EditorInteractionState['mode'];
  evalResult?: any; // TODO(ddimaria): fix type
  editorContent: string | undefined;
  isActive: boolean;
}

type Message = {
  role: 'user' | 'system' | 'assistant';
  content: string;
};

export const AiAssistant = ({ evalResult, editorMode, editorContent, isActive }: Props) => {
  const evalResultObj = evalResult;
  const stdErr = evalResultObj?.std_err;

  // TODO: Improve these messages. Pass current location and more docs.
  // store in a separate location for different cells
  const systemMessages = [
    {
      role: 'system',
      content:
        'You are a helpful assistant inside of a spreadsheet application called Quadratic. The cell type is: ' +
        editorMode,
    },
    {
      role: 'system',
      content: `here are the docs: ${QuadraticDocs}`,
    },
    {
      role: 'system',
      content: 'Currently, you are in a cell that is being edited. The code in the cell is:' + editorContent,
    },
    {
      role: 'system',
      content: 'If the code was recently run here is the std error:' + stdErr,
    },
  ] as Message[];

  const [prompt, setPrompt] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const controller = useRef<AbortController>();
  const { loggedInUser: user } = useRootRouteLoaderData();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus the input when the tab comes into focus
  useEffect(() => {
    if (isActive) {
      window.requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.focus();
        }
      });
    }
  }, [isActive]);

  const abortPrompt = () => {
    controller.current?.abort();
    setLoading(false);
  };

  const submitPrompt = async () => {
    if (loading) return;
    controller.current = new AbortController();
    setLoading(true);
    const token = await authClient.getTokenOrRedirect();
    const updatedMessages = [...messages, { role: 'user', content: prompt }] as Message[];
    const request_body = {
      model: 'gpt-4-32k',
      messages: [...systemMessages, ...updatedMessages],
    };
    setMessages(updatedMessages);
    setPrompt('');

    await fetch(`${apiClient.getApiUrl()}/ai/chat/stream`, {
      method: 'POST',
      signal: controller.current.signal,
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
        } as Message;
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

  const display_message = messages.filter((message, index) => message.role !== 'system');

  return (
    <>
      <div
        className="overflow-y-auto whitespace-pre-wrap pb-2 pl-3 pr-4 text-sm outline-none"
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
        <div id="ai-streaming-output">
          {display_message.map((message, index) => (
            <div
              key={index}
              style={{
                borderTop: index !== 0 ? `1px solid ${colors.lightGray}` : 'none',
                marginTop: '1rem',
                paddingTop: index !== 0 ? '1rem' : '0',
              }}
            >
              {message.role === 'user' ? (
                <Avatar
                  variant="rounded"
                  sx={{
                    bgcolor: colors.quadraticSecondary,
                    width: 24,
                    height: 24,
                    fontSize: '0.8rem',
                    marginBottom: '0.5rem',
                  }}
                  alt={user?.name}
                  src={user?.picture}
                ></Avatar>
              ) : (
                <Avatar
                  variant="rounded"
                  sx={{
                    bgcolor: 'white',
                    width: 24,
                    height: 24,
                    fontSize: '0.8rem',
                    marginBottom: '0.5rem',
                  }}
                  alt="AI Assistant"
                >
                  <AI sx={{ color: colors.languageAI }}></AI>
                </Avatar>
              )}
              <CodeBlockParser input={message.content} />
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
          onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
            setPrompt(event.target.value);
          }}
          onKeyDown={(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && prompt.trim().length > 0) {
              submitPrompt();
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
    </>
  );
};
