import { AIToolCard } from '@/app/ai/toolCards/AIToolCard';
import { aiToolsSpec, type AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolArgs, AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useMemo } from 'react';

type AIToolCardWithEditingProps = {
  toolCall: AIToolCall;
  onToolCallChange?: (toolCall: AIToolCall) => void;
};
export const AIToolCardWithEditing = memo(({ toolCall, onToolCallChange }: AIToolCardWithEditingProps) => {
  // Get tool specification
  const toolSpec = useMemo(() => {
    return aiToolsSpec[toolCall.name as AITool];
  }, [toolCall.name]);

  if (!onToolCallChange) {
    return <AIToolCard toolCall={toolCall} />;
  }

  if (!toolSpec) {
    return (
      <div className="rounded-lg border bg-gray-50 p-4">
        <p className="text-sm text-gray-600">Unknown tool: {toolCall.name}</p>

        <AIToolCard toolCall={toolCall} />
      </div>
    );
  }

  return <FormField parameter={toolSpec.parameters} value={toolCall.arguments} onChange={console.log} />;
});

interface FormFieldProps {
  parameter: AIToolArgs;
  value: string;
  onChange: (value: string) => void;
}
const FormField = memo(({ parameter, value, onChange }: FormFieldProps) => {
  const parsedValue = useMemo(() => {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }, [value]);

  console.log(parsedValue);

  return <div className=""></div>;
});
