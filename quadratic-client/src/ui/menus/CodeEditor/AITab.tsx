import { Send, Stop } from '@mui/icons-material';
import { Avatar, CircularProgress, FormControl, IconButton, InputAdornment, OutlinedInput } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../../../api/apiClient';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
import { authClient } from '../../../auth';
// import { CodeCellRunOutput } from '../../../quadratic-core/types';
import { useRootRouteLoaderData } from '../../../router';
import { colors } from '../../../theme/colors';
import ConditionalWrapper from '../../components/ConditionalWrapper';
import { TooltipHint } from '../../components/TooltipHint';
import { AI } from '../../icons';
import { CodeBlockParser } from './AICodeBlockParser';
import './AITab.css';
import { QuadraticDocs } from './QuadraticDocs';

// todo: fix types

interface Props {
  editorMode: EditorInteractionState['mode'];
  evalResult: any | undefined; // CodeCellRunOutput
  editorContent: string | undefined;
  isActive: boolean;
}

type Message = {
  role: 'user' | 'system' | 'assistant';
  content: string;
};

export const AITab = ({ evalResult, editorMode, editorContent, isActive }: Props) => {
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
      content: 'If the code was recently run here was the result:' + JSON.stringify(evalResult),
    },
  ] as Message[];

  const [prompt, setPrompt] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const controller = useRef<AbortController>();
  const { loggedInUser: user } = useRootRouteLoaderData();
  const inputRef = useRef<HTMLInputElement | undefined>(undefined);

  // Focus the input when the tab comes into focus
  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
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
        style={{
          position: 'absolute',
          bottom: '0',
          left: '0',
          right: '1rem',
          padding: '1rem 0 .5rem 1rem',
          background: 'linear-gradient(0deg, rgba(255,255,255,1) 85%, rgba(255,255,255,0) 100%)',
          zIndex: 100,
        }}
      >
        <FormControl fullWidth>
          <OutlinedInput
            id="prompt-input"
            value={prompt}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              setPrompt(event.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && prompt.length > 0) {
                submitPrompt();
              }
            }}
            placeholder="Ask a question"
            endAdornment={
              <InputAdornment position="end">
                {loading && <CircularProgress size="1.25rem" sx={{ mx: '1rem' }} />}
                {loading ? (
                  <TooltipHint title="Stop generating">
                    <IconButton size="small" color="primary" onClick={abortPrompt} edge="end">
                      <Stop />
                    </IconButton>
                  </TooltipHint>
                ) : (
                  <ConditionalWrapper
                    condition={prompt.length !== 0}
                    Wrapper={({ children }) => <TooltipHint title="Send">{children as React.ReactElement}</TooltipHint>}
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
              </InputAdornment>
            }
            size="small"
            fullWidth
            inputRef={inputRef}
            sx={{ py: '.25rem', pr: '1rem' }}
          />
        </FormControl>
      </div>
      <div
        spellCheck={false}
        onKeyDown={(e) => {
          if (((e.metaKey || e.ctrlKey) && e.key === 'a') || ((e.metaKey || e.ctrlKey) && e.key === 'c')) {
            // Allow a few commands, but nothing else
          } else {
            e.preventDefault();
          }
        }}
        style={{
          outline: 'none',
          whiteSpace: 'pre-wrap',
          paddingBottom: '5rem',
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
    </>
  );
};
