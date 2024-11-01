import {
  aiAnalystCurrentChatMessagesAtom,
  aiAnalystCurrentChatMessagesCountAtom,
  aiAnalystLoadingAtom,
  defaultAIAnalystContext,
} from '@/app/atoms/aiAnalystAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { AIAnalystSelectContextMenu } from '@/app/ui/menus/AIAnalyst/AIAnalystSelectContextMenu';
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
      className={`z-10 ml-2 flex select-none flex-wrap items-center gap-2 text-xs ${
        disabled || loading ? 'opacity-60' : ''
      } `}
    >
      <AIAnalystSelectContextMenu
        context={context}
        setContext={setContext}
        onClose={() => textAreaRef.current?.focus()}
        disabled={disabled}
      />

      <div>
        {`[`}
        {context.selection &&
          `(${context.selection.min.x}, ${context.selection.min.y}), (${context.selection.max.x}, ${context.selection.max.y}) `}
        {`Cursor]`}
      </div>

      {editing && !context.sheets.includes(sheets.sheet.name) && (
        <div key={sheets.sheet.name}>{`[${sheets.sheet.name}]`}</div>
      )}

      {context.sheets.map((sheet) => (
        <div key={sheet}>{`[${sheet}]`}</div>
      ))}
    </div>
  );
};
