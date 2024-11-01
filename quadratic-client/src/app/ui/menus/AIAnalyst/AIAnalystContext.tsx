import {
  aiAnalystCurrentChatMessagesAtom,
  aiAnalystCurrentChatMessagesCountAtom,
  aiAnalystLoadingAtom,
  defaultAIAnalystContext,
} from '@/app/atoms/aiAnalystAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { AIAnalystSelectContextMenu } from '@/app/ui/menus/AIAnalyst/AIAnalystSelectContextMenu';
import { CloseIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { Context, UserMessagePrompt } from 'quadratic-shared/typesAndSchemasAI';
import { useEffect } from 'react';
import { useRecoilValue } from 'recoil';

type AIAnalystContextProps = {
  context: Context;
  setContext: React.Dispatch<React.SetStateAction<Context>>;
  initialContext?: Context;
  editing: boolean;
  disabled: boolean;
  textAreaRef: React.RefObject<HTMLTextAreaElement>;
};

export const AIAnalystContext = ({
  context,
  setContext,
  initialContext,
  editing,
  disabled,
  textAreaRef,
}: AIAnalystContextProps) => {
  const loading = useRecoilValue(aiAnalystLoadingAtom);
  const messages = useRecoilValue(aiAnalystCurrentChatMessagesAtom);
  const messagesCount = useRecoilValue(aiAnalystCurrentChatMessagesCountAtom);

  useEffect(() => {
    if (!editing) return;
    const updateSelection = () => {
      const selection = sheets.getRustSelection();
      const rect = selection.rects?.[0];
      if (!rect || (rect.min.x === rect.max.x && rect.min.y === rect.max.y)) {
        setContext((prev) => ({
          ...prev,
          selection: undefined,
        }));
        return;
      }
      const sheetRect = {
        sheet_id: selection.sheet_id,
        min: { x: Number(rect.min.x), y: Number(rect.min.y) },
        max: { x: Number(rect.max.x), y: Number(rect.max.y) },
      };
      setContext((prev) => ({
        ...prev,
        selection: sheetRect,
      }));
    };
    updateSelection();

    events.on('cursorPosition', updateSelection);
    events.on('changeSheet', updateSelection);
    return () => {
      events.off('cursorPosition', updateSelection);
      events.off('changeSheet', updateSelection);
    };
  }, [editing, setContext]);

  // use last user message context as initial context in the bottom user message form
  useEffect(() => {
    if (initialContext === undefined && messagesCount > 0) {
      const lastUserMessage = messages
        .filter(
          (message): message is UserMessagePrompt => message.role === 'user' && message.contextType === 'userPrompt'
        )
        .at(-1);
      if (lastUserMessage) {
        setContext(lastUserMessage.context ?? defaultAIAnalystContext);
      }
    }
  }, [initialContext, messages, messagesCount, setContext]);

  return (
    <div
      className={cn(
        `z-10 ml-2 flex select-none flex-wrap items-center gap-1 text-xs`,
        disabled && 'select-none',
        loading && 'select-none opacity-60'
      )}
    >
      {editing && (
        <AIAnalystSelectContextMenu
          context={context}
          setContext={setContext}
          onClose={() => textAreaRef.current?.focus()}
          disabled={disabled}
        />
      )}

      <ContextPill
        key="cursor"
        primary={
          context.selection
            ? `(${context.selection.min.x}, ${context.selection.min.y}), (${context.selection.max.x}, ${context.selection.max.y}) `
            : // TODO: (ayush) add code to get cursor position
              '(0,0)'
        }
        secondary="Cursor"
        onClick={() => {}}
        disabled={disabled}
      />

      {editing && !context.sheets.includes(sheets.sheet.name) && (
        <ContextPill
          key={sheets.sheet.name}
          primary={sheets.sheet.name}
          secondary={'Sheet'}
          onClick={() => {}}
          disabled={disabled}
        />
      )}

      {context.sheets.map((sheet) => (
        <ContextPill key={sheet} primary={sheet} secondary={'Sheet'} disabled={disabled} onClick={() => {}} />
      ))}
    </div>
  );
};

function ContextPill({
  primary,
  secondary,
  onClick,
  disabled,
}: {
  primary: string;
  secondary: string;
  onClick?: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex h-5 items-center self-stretch rounded border border-border px-1 text-xs">
      <span>{primary}</span>
      <span className="ml-0.5 text-muted-foreground">{secondary}</span>
      {onClick && !disabled && (
        <Button
          size="icon-sm"
          className="-mr-0.5 ml-0 h-4 w-4 items-center shadow-none"
          variant="ghost"
          onClick={() => {
            // TODO: (ayush) add code to remove context
            window.alert('TODO(ayush): add code to remove context');
          }}
        >
          <CloseIcon className="!h-4 !w-4 !text-xs" />
        </Button>
      )}
    </div>
  );
}
