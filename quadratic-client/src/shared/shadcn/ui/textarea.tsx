import { cn } from '@/shared/shadcn/utils';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value?: string;
  autoHeight?: boolean;
  maxHeight?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, autoHeight, maxHeight, onChange, onKeyDown, style, value, ...props }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => textareaRef.current!);

    const adjustHeight = useCallback(() => {
      window.requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.style.height = '';
          textarea.style.height = `${textarea.scrollHeight}px`;
        }
      });
    }, [textareaRef]);

    const resetHeight = useCallback(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = '';
      }
    }, [textareaRef]);

    useEffect(() => {
      if (autoHeight === true) {
        adjustHeight();
      } else if (autoHeight === false) {
        resetHeight();
      }
    }, [value, adjustHeight, autoHeight, resetHeight]);

    return (
      <textarea
        ref={textareaRef}
        className={cn(
          'h-8 min-h-8 w-full resize-none rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
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
        value={value}
        rows={autoHeight === false ? value?.split('\n').length ?? 1 : undefined}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
