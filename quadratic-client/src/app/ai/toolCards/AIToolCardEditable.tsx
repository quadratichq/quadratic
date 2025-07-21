import './aiToolCardEditable.css';

import { AIToolCard } from '@/app/ai/toolCards/AIToolCard';
import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { aiToolsActions } from '@/app/ai/tools/aiToolsActions';
import { cn } from '@/shared/shadcn/utils';
import { Editor } from '@monaco-editor/react';
import { aiToolsSpec, type AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

interface AIToolCardEditableProps {
  toolCall: AIToolCall;
  onToolCallChange?: (toolCall: AIToolCall) => void;
}
export const AIToolCardEditable = memo(({ toolCall, onToolCallChange }: AIToolCardEditableProps) => {
  if (onToolCallChange) {
    return <FormField toolCall={toolCall} onToolCallChange={onToolCallChange} />;
  }

  return <AIToolCard toolCall={toolCall} />;
});

interface FormFieldProps {
  toolCall: AIToolCall;
  onToolCallChange: (newToolCall: AIToolCall) => void;
}
const FormField = memo(({ toolCall, onToolCallChange }: FormFieldProps) => {
  const toolSpec = useMemo(() => aiToolsSpec[toolCall.name as AITool], [toolCall.name]);
  const toolAction = useMemo(() => aiToolsActions[toolCall.name as AITool], [toolCall.name]);

  const prettyArguments = useMemo(() => {
    try {
      return JSON.stringify(JSON.parse(toolCall.arguments), null, 2);
    } catch {
      return toolCall.arguments;
    }
  }, [toolCall.arguments]);

  const [editorValue, setEditorValue] = useState(prettyArguments);
  const [editing, setEditing] = useState(false);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    setEditorValue(prettyArguments);
  }, [prettyArguments]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(editorValue);
      toolSpec.responseSchema.parse(parsed);
      setValid(true);
      const stringified = JSON.stringify(parsed);
      if (stringified !== toolCall.arguments) {
        onToolCallChange({ ...toolCall, arguments: stringified });
      }
    } catch {
      setValid(false);
    }
  }, [editing, editorValue, onToolCallChange, toolCall, prettyArguments, toolSpec.responseSchema]);

  const handleChange = useCallback((newValue: string | undefined) => {
    setEditorValue(newValue ?? '');
  }, []);

  const handleClick = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (!valid) {
        console.log('Invalid arguments');
        return;
      }

      try {
        const args = JSON.parse(editorValue);
        const result = await toolAction(args, {
          source: 'AIAnalyst',
          chatId: '',
          messageIndex: -1,
        });
        console.log(result);
      } catch (error) {
        console.error(error);
      }
    },
    [editorValue, toolAction, valid]
  );

  const handleRightClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setEditing((prev) => !prev);
  }, []);

  return (
    <div
      className={cn(
        editing && 'border border-dashed focus-within:border-solid',
        valid ? 'border-green-500' : 'border-red-500'
      )}
    >
      <div className="cursor-pointer" onClick={handleClick} onContextMenu={handleRightClick}>
        <AIToolCard toolCall={toolCall} />
      </div>

      <div className="tool-card-name cursor-pointer" onClick={handleClick} onContextMenu={handleRightClick}>
        <ToolCard label={toolCall.name} className="tool-card" />
      </div>

      {editing && (
        <div
          className="h-max overflow-hidden border border-border bg-background shadow-sm"
          style={{ height: `${Math.ceil(editorValue.split('\n').length) * 19 + 32}px` }}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Editor
            className="dark-mode-hack bg-transparent pt-2"
            language={'json'}
            value={editorValue}
            onChange={handleChange}
            height="100%"
            width="100%"
            options={{
              minimap: { enabled: false },
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              overviewRulerBorder: false,
              scrollbar: {
                vertical: 'hidden',
                handleMouseWheel: false,
              },
              scrollBeyondLastLine: false,
              wordWrap: 'off',
              lineNumbers: 'off',
              automaticLayout: true,
              folding: true,
              renderLineHighlightOnlyWhenFocus: true,
              fontSize: 14,
              lineHeight: 19,
            }}
          />
        </div>
      )}
    </div>
  );
});
