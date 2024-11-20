import { SelectAIModelMenu } from '@/app/ai/components/SelectAIModelMenu';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import ConditionalWrapper from '@/app/ui/components/ConditionalWrapper';
import { AIAnalystContext } from '@/app/ui/menus/AIAnalyst/AIAnalystContext';
import { ArrowUpwardIcon, BackspaceIcon, EditIcon } from '@/shared/components/Icons';
import { AI_SECURITY } from '@/shared/constants/urls';
import { Button } from '@/shared/shadcn/ui/button';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { Context } from 'quadratic-shared/typesAndSchemasAI';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { SetterOrUpdater } from 'recoil';

export type AIUserMessageFormWrapperProps = {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  autoFocusRef?: React.RefObject<boolean>;
  initialPrompt?: string;
  messageIndex?: number;
};

type Props = Omit<AIUserMessageFormWrapperProps, 'messageIndex'> & {
  abortController: AbortController | undefined;
  loading: boolean;
  setLoading: SetterOrUpdater<boolean>;
  submitPrompt: (prompt: string) => void;
  formOnKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  ctx?: {
    context: Context;
    setContext: React.Dispatch<React.SetStateAction<Context>>;
    initialContext?: Context;
  };
};

export const AIUserMessageForm = forwardRef<HTMLTextAreaElement, Props>((props: Props, ref) => {
  const {
    initialPrompt,
    ctx,
    autoFocusRef,
    textareaRef: bottomTextareaRef,
    abortController,
    loading,
    setLoading,
    submitPrompt,
    formOnKeyDown,
  } = props;

  const [editing, setEditing] = useState(!initialPrompt);
  const [prompt, setPrompt] = useState(initialPrompt ?? '');

  const abortPrompt = useCallback(() => {
    abortController?.abort();
    setLoading(false);
  }, [abortController, setLoading]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => textareaRef.current!);

  // Focus the input when relevant & the tab comes into focus
  useEffect(() => {
    if (autoFocusRef?.current) {
      window.requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    }
  }, [autoFocusRef, textareaRef]);

  useEffect(() => {
    if (loading && initialPrompt !== undefined) {
      setEditing(false);
    }
  }, [loading, initialPrompt]);

  return (
    <form
      className={cn('group relative h-min rounded-lg bg-accent', ctx && 'pt-1.5', editing ? '' : 'select-none')}
      onSubmit={(e) => e.preventDefault()}
      onClick={() => {
        if (editing) {
          textareaRef.current?.focus();
        }
      }}
    >
      {!editing && !loading && (
        <TooltipPopover label="Edit">
          <Button
            variant="ghost"
            className="pointer-events-auto absolute right-0.5 top-0.5 bg-accent text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
            size="icon-sm"
            onClick={(e) => {
              if (loading) return;
              e.stopPropagation();
              setEditing(true);
              textareaRef.current?.focus();
            }}
          >
            <EditIcon />
          </Button>
        </TooltipPopover>
      )}

      {ctx && <AIAnalystContext {...ctx} editing={editing} disabled={!editing} textAreaRef={textareaRef} />}

      {editing ? (
        <Textarea
          ref={textareaRef}
          value={prompt}
          className={cn(
            'rounded-none border-none p-2 pb-0 shadow-none focus-visible:ring-0',
            editing ? 'min-h-14' : 'pointer-events-none h-fit min-h-fit'
          )}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation();

            if (event.key === 'Enter' && !(event.ctrlKey || event.shiftKey)) {
              event.preventDefault();

              if (prompt.trim().length === 0) return;

              submitPrompt(prompt);

              if (initialPrompt === undefined) {
                setPrompt('');
                textareaRef.current?.focus();
              } else {
                setEditing(false);
                bottomTextareaRef.current?.focus();
              }
            }
            if (formOnKeyDown) {
              formOnKeyDown(event);
            }
          }}
          autoComplete="off"
          placeholder="Ask a question..."
          autoHeight={true}
          maxHeight="120px"
        />
      ) : (
        <div className="pointer-events-none whitespace-pre-wrap p-2 text-sm">{prompt}</div>
      )}

      {editing && (
        <>
          <div className="flex w-full select-none items-center justify-between px-2 pb-1 @container">
            <SelectAIModelMenu loading={loading} textAreaRef={textareaRef} />

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="hidden @sm:block">
                {KeyboardSymbols.Shift}
                {KeyboardSymbols.Enter} new line
              </span>

              <span className="hidden @sm:block">{KeyboardSymbols.Enter} submit</span>

              <ConditionalWrapper
                condition={prompt.length !== 0}
                Wrapper={({ children }) => (
                  <TooltipPopover label="Submit" shortcut={`${KeyboardSymbols.Enter}`}>
                    {children as React.ReactElement}
                  </TooltipPopover>
                )}
              >
                <Button
                  size="icon-sm"
                  className="rounded-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    submitPrompt(prompt);
                  }}
                  disabled={prompt.length === 0 || loading}
                >
                  <ArrowUpwardIcon />
                </Button>
              </ConditionalWrapper>
            </div>
          </div>

          {loading && (
            <Button
              size="sm"
              variant="outline"
              className="absolute -top-9 right-1/2 z-10 translate-x-1/2 bg-background"
              onClick={(e) => {
                e.stopPropagation();
                abortPrompt();
              }}
            >
              <BackspaceIcon className="mr-1" /> Cancel generating
            </Button>
          )}
        </>
      )}
    </form>
  );
});

export const AIUserMessageFormDisclaimer = () => {
  return (
    <p className="py-0.5 text-center text-xs text-muted-foreground">
      Some sheet data is sent to the AI model.{' '}
      <a href={AI_SECURITY} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
        Learn more.
      </a>
    </p>
  );
};
