import * as React from 'react';

import { cn } from '@/shared/shadcn/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoHeight?: boolean;
  maxHeight?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, autoHeight, maxHeight, onChange, onKeyDown, style, ...props }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    React.useImperativeHandle(ref, () => textareaRef.current!);

    const adjustHeight = React.useCallback(() => {
      window.requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.style.height = '';
          textarea.style.height = `${textarea.scrollHeight + 2}px`;
        }
      });
    }, [textareaRef]);

    return (
      <textarea
        ref={textareaRef}
        className={cn(
          'flex h-8 min-h-8 w-full resize-none rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        style={{
          maxHeight,
          ...style,
        }}
        onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
          onChange?.(event);
          if (autoHeight) {
            adjustHeight();
          }
        }}
        onKeyDown={(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
          onKeyDown?.(event);
          if (autoHeight) {
            adjustHeight();
          }
        }}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
