import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { sheets } from '@/app/grid/controller/Sheets';
import { FormatPaintIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { z } from 'zod';

type SetTextFormatsResponse = z.infer<(typeof aiToolsSpec)[AITool.SetTextFormats]['responseSchema']>;

interface FormatItem {
  label: string;
  colorSwatch?: string;
}

function getFormattingItems(data: SetTextFormatsResponse): FormatItem[] {
  const items: FormatItem[] = [];

  if (data.bold === true) items.push({ label: 'bold' });
  if (data.italic === true) items.push({ label: 'italic' });
  if (data.underline === true) items.push({ label: 'underline' });
  if (data.strike_through === true) items.push({ label: 'strikethrough' });
  if (data.text_color) items.push({ label: 'text', colorSwatch: data.text_color });
  if (data.fill_color) items.push({ label: 'fill', colorSwatch: data.fill_color });
  if (data.align) items.push({ label: `align: ${data.align}` });
  if (data.vertical_align) items.push({ label: `v-align: ${data.vertical_align}` });
  if (data.wrap) items.push({ label: `wrap: ${data.wrap}` });
  if (data.numeric_commas === true) items.push({ label: 'commas' });
  if (data.number_type) items.push({ label: data.number_type });
  if (data.currency_symbol) items.push({ label: `currency: ${data.currency_symbol}` });
  if (data.date_time) items.push({ label: `date: ${data.date_time}` });
  if (data.font_size !== undefined && data.font_size !== null) items.push({ label: `${data.font_size}pt` });

  return items;
}

export const SetTextFormats = memo(
  ({
    toolCall: { arguments: args, loading },
    className,
    hideIcon,
  }: {
    toolCall: AIToolCall;
    className: string;
    hideIcon?: boolean;
  }) => {
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
      const verb = loading ? 'Formatting' : 'Formatted';
      return `${verb} ${range}`;
    }, [toolArgs, loading]);

    const formattingItems = useMemo(() => {
      if (!toolArgs?.success || !toolArgs.data) return [];
      return getFormattingItems(toolArgs.data);
    }, [toolArgs]);

    const description = useMemo(() => {
      if (formattingItems.length === 0) return undefined;
      return (
        <span className="inline-flex flex-wrap items-center gap-x-1">
          {formattingItems.map((item, index) => (
            <span key={index} className="inline-flex items-center">
              {item.label}
              {item.colorSwatch && (
                <span
                  className="ml-0.5 inline-block h-3 w-3 rounded-sm border border-border"
                  style={{ backgroundColor: item.colorSwatch }}
                />
              )}
              {index < formattingItems.length - 1 && <span className="mr-0.5">,</span>}
            </span>
          ))}
        </span>
      );
    }, [formattingItems]);

    const handleClick = useCallback(() => {
      if (!toolArgs?.success || !toolArgs.data?.selection) return;
      try {
        const sheetId = toolArgs.data.sheet_name
          ? (sheets.getSheetByName(toolArgs.data.sheet_name)?.id ?? sheets.current)
          : sheets.current;
        const selection = sheets.stringToSelection(toolArgs.data.selection, sheetId);
        sheets.changeSelection(selection);
      } catch (e) {
        console.warn('Failed to select range:', e);
      }
    }, [toolArgs]);

    if (loading) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact hideIcon={hideIcon} />;
    }

    if (!!toolArgs && !toolArgs.success) {
      return <ToolCard icon={icon} label={label} hasError className={className} compact hideIcon={hideIcon} />;
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact hideIcon={hideIcon} />;
    }

    return (
      <ToolCard
        icon={icon}
        label={label}
        description={description}
        className={className}
        compact
        onClick={handleClick}
        hideIcon={hideIcon}
      />
    );
  }
);
