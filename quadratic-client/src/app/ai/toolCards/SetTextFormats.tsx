import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { FormatPaintIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useMemo, useState } from 'react';
import type { z } from 'zod';

type SetTextFormatsResponse = z.infer<(typeof aiToolsSpec)[AITool.SetTextFormats]['responseSchema']>;

function describeFormatting(data: SetTextFormatsResponse): string {
  const formats: string[] = [];

  if (data.bold === true) formats.push('bold');
  if (data.italic === true) formats.push('italic');
  if (data.underline === true) formats.push('underline');
  if (data.strike_through === true) formats.push('strikethrough');
  if (data.text_color) formats.push(`text: ${data.text_color}`);
  if (data.fill_color) formats.push(`fill: ${data.fill_color}`);
  if (data.align) formats.push(`align: ${data.align}`);
  if (data.vertical_align) formats.push(`v-align: ${data.vertical_align}`);
  if (data.wrap) formats.push(`wrap: ${data.wrap}`);
  if (data.numeric_commas === true) formats.push('commas');
  if (data.number_type) formats.push(data.number_type);
  if (data.currency_symbol) formats.push(`currency: ${data.currency_symbol}`);
  if (data.date_time) formats.push(`date: ${data.date_time}`);
  if (data.font_size !== undefined && data.font_size !== null) formats.push(`size: ${data.font_size}pt`);

  return formats.length > 0 ? formats.join(', ') : 'formatting';
}

export const SetTextFormats = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<SetTextFormatsResponse, SetTextFormatsResponse>>();

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.SetTextFormats].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[SetTextFormats] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const icon = <FormatPaintIcon />;

    const label = useMemo(() => {
      const range = toolArgs?.success && toolArgs.data?.selection ? toolArgs.data.selection : '...';
      return `Formatting ${range}`;
    }, [toolArgs]);

    const description = useMemo(() => {
      if (!toolArgs?.success || !toolArgs.data) return undefined;
      return describeFormatting(toolArgs.data);
    }, [toolArgs]);

    if (loading) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact />;
    }

    if (!!toolArgs && !toolArgs.success) {
      return <ToolCard icon={icon} label={label} hasError className={className} compact />;
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact />;
    }

    return <ToolCard icon={icon} label={label} description={description} className={className} compact />;
  }
);
