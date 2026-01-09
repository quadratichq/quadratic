import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { sheets } from '@/app/grid/controller/Sheets';
import { FormatPaintIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { z } from 'zod';

type SetTextFormatsResponse = z.infer<(typeof aiToolsSpec)[AITool.SetTextFormats]['responseSchema']>;
type FormatEntry = SetTextFormatsResponse['formats'][number];

interface FormatItem {
  label: string;
  colorSwatch?: string;
}

function getFormattingItemsForEntry(entry: FormatEntry): FormatItem[] {
  const items: FormatItem[] = [];

  if (entry.bold === true) items.push({ label: 'bold' });
  if (entry.italic === true) items.push({ label: 'italic' });
  if (entry.underline === true) items.push({ label: 'underline' });
  if (entry.strike_through === true) items.push({ label: 'strikethrough' });
  if (entry.text_color) items.push({ label: 'text', colorSwatch: entry.text_color });
  if (entry.fill_color) items.push({ label: 'fill', colorSwatch: entry.fill_color });
  if (entry.align) items.push({ label: `align: ${entry.align}` });
  if (entry.vertical_align) items.push({ label: `v-align: ${entry.vertical_align}` });
  if (entry.wrap) items.push({ label: `wrap: ${entry.wrap}` });
  if (entry.numeric_commas === true) items.push({ label: 'commas' });
  if (entry.number_type) items.push({ label: entry.number_type });
  if (entry.currency_symbol) items.push({ label: `currency: ${entry.currency_symbol}` });
  if (entry.date_time) items.push({ label: `date: ${entry.date_time}` });
  if (entry.font_size !== undefined && entry.font_size !== null) items.push({ label: `${entry.font_size}pt` });

  return items;
}

function getFormattingItems(data: SetTextFormatsResponse): FormatItem[] {
  // Aggregate all formatting items from all entries (for grouped display), deduplicating by label+colorSwatch
  const seen = new Set<string>();
  const items: FormatItem[] = [];
  for (const entry of data.formats) {
    for (const item of getFormattingItemsForEntry(entry)) {
      const key = item.colorSwatch ? `${item.label}:${item.colorSwatch}` : item.label;
      if (!seen.has(key)) {
        seen.add(key);
        items.push(item);
      }
    }
  }
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
      if (!toolArgs?.success || !toolArgs.data?.formats?.length) {
        const verb = loading ? 'Formatting' : 'Formatted';
        return `${verb} ...`;
      }

      const verb = loading ? 'Formatting' : 'Formatted';
      const selections = toolArgs.data.formats.map((f) => f.selection);
      if (selections.length === 1) {
        return `${verb} ${selections[0]}`;
      }
      return `${verb} ${selections.length} selections`;
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
      if (!toolArgs?.success || !toolArgs.data?.formats?.length) return;
      try {
        // Select the first format entry's selection
        const firstEntry = toolArgs.data.formats[0];
        const sheetId = firstEntry.sheet_name
          ? (sheets.getSheetByName(firstEntry.sheet_name)?.id ?? sheets.current)
          : sheets.current;
        const selection = sheets.stringToSelection(firstEntry.selection, sheetId);
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
