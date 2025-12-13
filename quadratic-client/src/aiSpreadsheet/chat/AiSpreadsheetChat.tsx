import {
  addChatMessage,
  aiSpreadsheetAtom,
  aiSpreadsheetChatMessagesAtom,
  aiSpreadsheetLoadingAtom,
  aiSpreadsheetStreamingContentAtom,
  aiSpreadsheetStreamingToolCallsAtom,
} from '@/aiSpreadsheet/atoms/aiSpreadsheetAtom';
import { AiSpreadsheetChatForm } from '@/aiSpreadsheet/chat/AiSpreadsheetChatForm';
import { useAiSpreadsheetTools } from '@/aiSpreadsheet/hooks/useAiSpreadsheetTools';
import type { ChatMessage } from '@/aiSpreadsheet/types';
import { Markdown } from '@/app/ui/components/Markdown';
import { AIIcon, DatabaseIcon, CodeIcon, TableIcon, InsertChartIcon, FileIcon } from '@/shared/components/Icons';
import { ChevronDownIcon, ChevronRightIcon, Link1Icon, PersonIcon, ReloadIcon, TrashIcon } from '@radix-ui/react-icons';
import { useEffect, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

interface Connection {
  uuid: string;
  name: string;
  type: string;
}

interface AiSpreadsheetChatProps {
  teamUuid: string;
  connections: Connection[];
}

export function AiSpreadsheetChat({ teamUuid, connections }: AiSpreadsheetChatProps) {
  const messages = useRecoilValue(aiSpreadsheetChatMessagesAtom);
  const loading = useRecoilValue(aiSpreadsheetLoadingAtom);
  const streamingContent = useRecoilValue(aiSpreadsheetStreamingContentAtom);
  const streamingToolCalls = useRecoilValue(aiSpreadsheetStreamingToolCallsAtom);
  const [state, setState] = useRecoilState(aiSpreadsheetAtom);
  const { processAiResponse, abortRequest } = useAiSpreadsheetTools();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Debug: log state changes
  useEffect(() => {
    console.log('[AI Chat] State changed - messages:', messages.length, 'loading:', loading);
  }, [messages, loading]);

  // Auto-scroll to bottom when new messages arrive or streaming updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, streamingToolCalls]);

  const handleSendMessage = async (content: string) => {
    console.log('[AI Chat] handleSendMessage called with:', content);
    // Add user message
    const newMessages = addChatMessage(state, { role: 'user', content });
    console.log('[AI Chat] Created newMessages, length:', newMessages.length);
    setState((prev) => ({ ...prev, chatMessages: newMessages, loading: true }));

    try {
      console.log('[AI Chat] Calling processAiResponse...');
      await processAiResponse(content, connections);
      console.log('[AI Chat] processAiResponse completed');
    } catch (error) {
      console.error('[AI Chat] Error processing AI response:', error);
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
        <AiSpreadsheetChatForm onSend={handleSendMessage} disabled={loading} connections={connections} />
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
      <h3 className="mb-2 text-lg font-semibold">AI Spreadsheet</h3>
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
  const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;

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
        {/* Tool calls */}
        {hasToolCalls && (
          <div className="space-y-1">
            {message.toolCalls!.map((toolCall) => (
              <ToolCallCard key={toolCall.id} toolCall={toolCall} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StreamingMessage({
  content,
  toolCalls,
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
            <span className="ml-2 text-xs text-muted-foreground">Thinking...</span>
          </div>
        )}
        {/* Streaming tool calls */}
        {toolCalls.length > 0 && (
          <div className="space-y-1">
            {toolCalls.map((toolCall) => (
              <ToolCallCard key={toolCall.id} toolCall={toolCall} isStreaming={!toolCall.processed} />
            ))}
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

function ToolCallCard({
  toolCall,
  isStreaming = false,
}: {
  toolCall: { id: string; name: string; arguments: string };
  isStreaming?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const getToolIcon = (name: string) => {
    if (name.includes('input')) {
      if (name.includes('connection')) return <DatabaseIcon className="h-3 w-3" />;
      if (name.includes('file')) return <FileIcon className="h-3 w-3" />;
      return <DatabaseIcon className="h-3 w-3" />;
    }
    if (name.includes('transform') || name.includes('code') || name.includes('formula')) {
      return <CodeIcon className="h-3 w-3" />;
    }
    if (name.includes('output')) {
      if (name.includes('chart')) return <InsertChartIcon className="h-3 w-3" />;
      return <TableIcon className="h-3 w-3" />;
    }
    if (name.includes('connect')) return <Link1Icon className="h-3 w-3" />;
    if (name.includes('remove') || name.includes('clear')) return <TrashIcon className="h-3 w-3" />;
    if (name.includes('update')) return <ReloadIcon className="h-3 w-3" />;
    return <AIIcon size="sm" />;
  };

  const getToolColor = (name: string) => {
    if (name.includes('input')) return 'border-yellow-500/50 bg-yellow-500/10';
    if (name.includes('transform')) return 'border-blue-500/50 bg-blue-500/10';
    if (name.includes('output')) return 'border-pink-500/50 bg-pink-500/10';
    if (name.includes('connect')) return 'border-green-500/50 bg-green-500/10';
    if (name.includes('remove') || name.includes('clear')) return 'border-red-500/50 bg-red-500/10';
    return 'border-border bg-muted/50';
  };

  const formatToolName = (name: string) => {
    // Replace "node" with "cell" for user-facing text
    return name
      .replace(/_/g, ' ')
      .replace(/node/gi, 'cell')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const parseArgs = () => {
    try {
      return JSON.parse(toolCall.arguments);
    } catch {
      return null;
    }
  };

  const args = parseArgs();
  const label = args?.label || args?.node_id || '';

  return (
    <div
      className={`rounded-md border px-3 py-2 text-xs ${getToolColor(toolCall.name)} ${
        isStreaming ? 'animate-pulse' : ''
      }`}
    >
      <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center gap-2">
        {expanded ? (
          <ChevronDownIcon className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="h-3 w-3 text-muted-foreground" />
        )}
        {getToolIcon(toolCall.name)}
        <span className="font-medium">{formatToolName(toolCall.name)}</span>
        {label && <span className="text-muted-foreground">— {label}</span>}
        {isStreaming && (
          <span className="ml-auto flex items-center gap-1 text-muted-foreground">
            <ReloadIcon className="h-3 w-3 animate-spin" />
          </span>
        )}
      </button>
      {expanded && args && (
        <pre className="mt-2 max-h-32 overflow-auto rounded bg-background/50 p-2 text-[10px] text-muted-foreground">
          {JSON.stringify(args, null, 2)}
        </pre>
      )}
    </div>
  );
}
