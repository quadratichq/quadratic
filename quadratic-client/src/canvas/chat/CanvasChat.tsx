import {
  addChatMessage,
  canvasAtom,
  canvasChatMessagesAtom,
  canvasLoadingAtom,
  canvasStreamingContentAtom,
  canvasStreamingToolCallsAtom,
} from '@/canvas/atoms/canvasAtom';
import { CanvasChatForm } from '@/canvas/chat/CanvasChatForm';
import { useCanvasTools } from '@/canvas/hooks/useCanvasTools';
import type { ChatMessage } from '@/canvas/types';
import { Markdown } from '@/app/ui/components/Markdown';
import { AIIcon } from '@/shared/components/Icons';
import { PersonIcon, TrashIcon } from '@radix-ui/react-icons';
import { useEffect, useRef } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

interface Connection {
  uuid: string;
  name: string;
  type: string;
}

interface CanvasChatProps {
  teamUuid: string;
  connections: Connection[];
}

export function CanvasChat({ teamUuid, connections }: CanvasChatProps) {
  const messages = useRecoilValue(canvasChatMessagesAtom);
  const loading = useRecoilValue(canvasLoadingAtom);
  const streamingContent = useRecoilValue(canvasStreamingContentAtom);
  const streamingToolCalls = useRecoilValue(canvasStreamingToolCallsAtom);
  const [state, setState] = useRecoilState(canvasAtom);
  const { processAiResponse, abortRequest } = useCanvasTools();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Debug: log state changes
  useEffect(() => {
    console.log('[Canvas Chat] State changed - messages:', messages.length, 'loading:', loading);
  }, [messages, loading]);

  // Auto-scroll to bottom when new messages arrive or streaming updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, streamingToolCalls]);

  const handleSendMessage = async (content: string) => {
    console.log('[Canvas Chat] handleSendMessage called with:', content);
    // Add user message
    const newMessages = addChatMessage(state, { role: 'user', content });
    console.log('[Canvas Chat] Created newMessages, length:', newMessages.length);
    setState((prev) => ({ ...prev, chatMessages: newMessages, loading: true }));

    try {
      console.log('[Canvas Chat] Calling processAiResponse...');
      await processAiResponse(content, connections);
      console.log('[Canvas Chat] processAiResponse completed');
    } catch (error) {
      console.error('[Canvas Chat] Error processing AI response:', error);
      const errorMessages = addChatMessage(
        { ...state, chatMessages: newMessages },
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }
      );
      setState((prev) => ({ ...prev, chatMessages: errorMessages, loading: false }));
    }
  };

  const handleAbort = () => {
    abortRequest();
    setState((prev) => ({ ...prev, loading: false, streamingContent: '', streamingToolCalls: [] }));
  };

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-auto">
        {messages.length === 0 && !loading ? (
          <EmptyState />
        ) : (
          <div className="space-y-4 p-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {loading && (
              <StreamingMessage content={streamingContent} toolCalls={streamingToolCalls} onAbort={handleAbort} />
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input form */}
      <div className="border-t border-border p-4">
        <CanvasChatForm onSend={handleSendMessage} disabled={loading} connections={connections} />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <AIIcon size="lg" className="text-primary" />
      </div>
      <h3 className="mb-2 text-lg font-semibold">Canvas</h3>
      <p className="mb-4 max-w-sm text-sm text-muted-foreground">
        Describe the model you want to build. I'll create input cells, formula cells, and output cells on your canvas.
      </p>
      <div className="space-y-2 text-left text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Try asking:</p>
        <ul className="list-inside list-disc space-y-1">
          <li>"Create a mortgage calculator"</li>
          <li>"Calculate sales tax for different states"</li>
          <li>"Build a compound interest calculator"</li>
        </ul>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  // Don't render assistant messages that only have tool calls (no text content)
  if (!isUser && !message.content) {
    return null;
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        }`}
      >
        {isUser ? <PersonIcon className="h-4 w-4" /> : <AIIcon size="sm" />}
      </div>
      <div className={`max-w-[85%] space-y-2`}>
        {/* Text content */}
        {message.content && (
          <div className={`rounded-lg px-4 py-2 ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            {isUser ? (
              <p className="whitespace-pre-wrap text-sm">{message.content}</p>
            ) : (
              <div className="text-sm">
                <Markdown text={message.content} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StreamingMessage({
  content,
  onAbort,
}: {
  content: string;
  toolCalls: { id: string; name: string; arguments: string; processed?: boolean }[];
  onAbort: () => void;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <AIIcon size="sm" className="animate-pulse" />
      </div>
      <div className="max-w-[85%] space-y-2">
        {/* Streaming text */}
        {content ? (
          <div className="rounded-lg bg-muted px-4 py-2">
            <div className="text-sm">
              <Markdown text={content} />
            </div>
            <span className="inline-block h-4 w-1 animate-pulse bg-foreground" />
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2">
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
            <span className="ml-2 text-xs text-muted-foreground">Building...</span>
          </div>
        )}
        {/* Abort button */}
        <button
          onClick={onAbort}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <TrashIcon className="h-3 w-3" />
          Stop
        </button>
      </div>
    </div>
  );
}
