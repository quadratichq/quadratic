import { Button } from '@/shared/shadcn/ui/button';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { PaperPlaneIcon } from '@radix-ui/react-icons';
import { useCallback, useState, type KeyboardEvent } from 'react';

interface Connection {
  uuid: string;
  name: string;
  type: string;
}

interface CanvasChatFormProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  connections: Connection[];
}

export function CanvasChatForm({ onSend, disabled, connections }: CanvasChatFormProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = useCallback(() => {
    if (!message.trim() || disabled) return;
    onSend(message.trim());
    setMessage('');
  }, [message, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="space-y-2">
      {/* Quick suggestions */}
      {connections.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {connections.slice(0, 3).map((conn) => (
            <button
              key={conn.uuid}
              onClick={() => setMessage(`Use the ${conn.name} connection to `)}
              className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground transition-colors hover:bg-accent/80"
              disabled={disabled}
            >
              {conn.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe what you want to build..."
          className="max-h-32 min-h-10 resize-none"
          disabled={disabled}
        />
        <Button onClick={handleSubmit} disabled={!message.trim() || disabled} size="icon" className="shrink-0">
          <PaperPlaneIcon className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Press Enter to send, Shift+Enter for new line</p>
    </div>
  );
}
