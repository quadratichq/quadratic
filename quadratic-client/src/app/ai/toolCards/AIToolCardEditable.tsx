import './aiToolCardEditable.css';

import { AIToolCard } from '@/app/ai/toolCards/AIToolCard';
import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { aiToolsActions } from '@/app/ai/tools/aiToolsActions';
import { DEFAULT_FONT_SIZE } from '@/shared/constants/gridConstants';
import { cn } from '@/shared/shadcn/utils';
import { Editor } from '@monaco-editor/react';
import { AIToolSchema, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

interface AIToolCardEditableProps {
  toolCall: AIToolCall;
  onToolCallChange?: (toolCall: AIToolCall) => void;
}
export const AIToolCardEditable = memo(({ toolCall, onToolCallChange }: AIToolCardEditableProps) => {
  const content = onToolCallChange ? (
    <AIToolCallEditor toolCall={toolCall} onToolCallChange={onToolCallChange} />
  ) : (
    <AIToolCard toolCall={toolCall} />
  );

  return content;
});

interface AIToolCallEditorProps {
  toolCall: AIToolCall;
  onToolCallChange: (newToolCall: AIToolCall) => void;
}
const AIToolCallEditor = memo(({ toolCall, onToolCallChange }: AIToolCallEditorProps) => {
  const aiTool = useMemo(() => AIToolSchema.parse(toolCall.name), [toolCall.name]);
  const toolSpec = useMemo(() => aiToolsSpec[aiTool], [aiTool]);
  const toolAction = useMemo(() => aiToolsActions[aiTool], [aiTool]);

  const prettyArguments = useMemo(() => {
    try {
      return JSON.stringify(toolCall.arguments ? JSON.parse(toolCall.arguments) : {}, null, 2);
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
        const args = toolSpec.responseSchema.parse(JSON.parse(editorValue));
        const result = await toolAction(args as any, {
          source: 'AIAnalyst',
          chatId: '',
          messageIndex: -1,
        });
        console.log(result);
      } catch (error) {
        console.error(error);
      }
    },
    [editorValue, toolAction, toolSpec.responseSchema, valid]
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
              fontSize: DEFAULT_FONT_SIZE,
              lineHeight: 19,
            }}
          />
        </div>
      )}
    </div>
  );
});
