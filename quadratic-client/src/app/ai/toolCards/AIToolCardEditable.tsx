import { AIToolCard } from '@/app/ai/toolCards/AIToolCard';
import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { cn } from '@/shared/shadcn/utils';
import { Editor } from '@monaco-editor/react';
import { aiToolsSpec, type AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { ZodSchema } from 'zod';
import './aiToolCardEditable.css';

interface AIToolCardEditableProps {
  toolCall: AIToolCall;
  onToolCallChange?: (toolCall: AIToolCall) => void;
}
export const AIToolCardEditable = memo(({ toolCall, onToolCallChange }: AIToolCardEditableProps) => {
  const toolSpec = useMemo(() => aiToolsSpec[toolCall.name as AITool], [toolCall.name]);

  if (!onToolCallChange) {
    return (
      <div>
        <AIToolCard toolCall={toolCall} />
      </div>
    );
  }

  if (!toolSpec) {
    return (
      <div className="rounded-lg border bg-gray-50 p-4">
        <p className="text-sm text-gray-600">Unknown tool: {toolCall.name}</p>

        <AIToolCard toolCall={toolCall} />
      </div>
    );
  }

  return <FormField responseSchema={toolSpec.responseSchema} toolCall={toolCall} onToolCallChange={onToolCallChange} />;
});

interface FormFieldProps {
  responseSchema: ZodSchema;
  toolCall: AIToolCall;
  onToolCallChange: (newToolCall: AIToolCall) => void;
}
const FormField = memo(({ responseSchema, toolCall, onToolCallChange }: FormFieldProps) => {
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

  const handleChange = useCallback((newValue: string | undefined) => {
    setEditorValue(newValue ?? '');
  }, []);

  const handleToggleEditing = useCallback(() => {
    setEditing((prev) => {
      const newEditing = !prev;
      if (newEditing) {
        setEditorValue(prettyArguments);
      }
      return newEditing;
    });
  }, [prettyArguments]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(editorValue);
      responseSchema.parse(parsed);
      setValid(true);
      const stringified = JSON.stringify(parsed);
      if (stringified !== toolCall.arguments) {
        onToolCallChange({ ...toolCall, arguments: stringified });
      }
    } catch {
      setValid(false);
    }
  }, [editing, editorValue, onToolCallChange, responseSchema, toolCall]);

  return (
    <div
      className={cn(
        editing && 'border border-dashed focus-within:border-solid',
        valid ? 'border-green-500' : 'border-red-500'
      )}
    >
      <div className="cursor-pointer" onDoubleClick={handleToggleEditing}>
        <AIToolCard toolCall={toolCall} />
      </div>

      <div className="tool-card-name cursor-pointer" onDoubleClick={handleToggleEditing}>
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
