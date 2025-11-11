import { ArrowUpwardIcon, ChevronLeftIcon } from '@/shared/components/Icons';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { Button } from '@/shared/shadcn/ui/button';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { cn } from '@/shared/shadcn/utils';
import { useState } from 'react';

interface AIChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (message: string) => void;
  onBack?: () => void;
  placeholder?: string;
  title?: string;
  description?: string;
  showAsChatBox?: boolean;
}

export function AIChatDialog({
  open,
  onOpenChange,
  onSubmit,
  onBack,
  placeholder = 'What would you like to analyze?',
  title = 'Start a conversation',
  description = "Ask a question or describe what you'd like to do with your data",
  showAsChatBox = false,
}: AIChatDialogProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0) return;

    onSubmit(trimmedMessage);
    setMessage('');
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const disabledSubmit = message.trim().length === 0;

  if (showAsChatBox) {
    // Show as chat box only (no dialog header)
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl border-none p-0">
          {onBack && (
            <div className="px-6 pb-2 pt-6">
              <Button type="button" variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
                <ChevronLeftIcon />
              </Button>
            </div>
          )}
          <div className="px-6 pb-6">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-center text-2xl font-bold">{title}</DialogTitle>
              {description && <DialogDescription className="text-center">{description}</DialogDescription>}
            </DialogHeader>
            <form
              className={cn(
                'group relative h-min rounded-lg border border-accent bg-accent pt-1.5 has-[textarea:focus]:border-primary'
              )}
              onSubmit={handleSubmit}
            >
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={placeholder}
                className="min-h-14 resize-none rounded-none border-none p-2 pb-0 pt-1 shadow-none focus-visible:ring-0"
                autoFocus
                onKeyDown={handleKeyDown}
                autoHeight={true}
                maxHeight="120px"
              />
              <div className="flex w-full select-none items-center justify-between px-2 pb-1 text-xs">
                <div className="flex items-center gap-1"></div>
                <div className="flex items-center gap-3">
                  <Button size="icon-sm" className="rounded-full" type="submit" disabled={disabledSubmit}>
                    <ArrowUpwardIcon />
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {onBack && (
              <Button type="button" variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
                <ChevronLeftIcon />
              </Button>
            )}
            <div className="flex-1">
              <DialogTitle className="text-center text-2xl font-bold">{title}</DialogTitle>
              {description && <DialogDescription className="text-center">{description}</DialogDescription>}
            </div>
            {onBack && <div className="w-8"></div>}
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={placeholder}
            className="min-h-[120px] resize-none"
            autoFocus
            onKeyDown={handleKeyDown}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={disabledSubmit}>
              Send
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
