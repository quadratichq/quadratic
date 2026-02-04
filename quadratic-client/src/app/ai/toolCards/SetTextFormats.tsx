import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { sheets } from '@/app/grid/controller/Sheets';
import { FormatPaintIcon } from '@/shared/components/Icons';
import { cn } from '@/shared/shadcn/utils';
import { ChevronDownIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { AITool, AIToolsArgsSchema, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { z } from 'zod';

type SetTextFormatsResponse = AIToolsArgs[AITool.SetTextFormats];
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

// Render format items inline with color swatches
function FormatItemsDisplay({ items, maxItems }: { items: FormatItem[]; maxItems?: number }) {
  if (items.length === 0) return null;

  const displayItems = maxItems ? items.slice(0, maxItems) : items;
  const remainingCount = maxItems && maxItems < items.length ? items.length - maxItems : 0;

  return (
    <span className="inline-flex flex-wrap items-center gap-x-1">
      {displayItems.map((item, index) => (
        <span key={index} className="inline-flex items-center">
          {item.label}
          {item.colorSwatch && (
            <span
              className="ml-0.5 inline-block h-3 w-3 rounded-sm border border-border"
              style={{ backgroundColor: item.colorSwatch }}
            />
          )}
          {index < displayItems.length - 1 && <span className="mr-0.5">,</span>}
        </span>
      ))}
      {remainingCount > 0 && <span className="text-muted-foreground/60">+{remainingCount} more</span>}
    </span>
  );
}

// Individual selection item that can be clicked to navigate
const SelectionItem = memo(({ entry, onSelect }: { entry: FormatEntry; onSelect: (entry: FormatEntry) => void }) => {
  const formatItems = useMemo(() => getFormattingItemsForEntry(entry), [entry]);

  return (
    <div
      className="flex cursor-pointer items-center gap-1 text-sm text-muted-foreground hover:text-foreground/80"
      onClick={() => onSelect(entry)}
    >
      <span className="shrink-0 font-medium">{entry.selection}</span>
      <span className="text-muted-foreground/60">•</span>
      <span className="min-w-0 truncate">
        <FormatItemsDisplay items={formatItems} />
      </span>
    </div>
  );
});
SelectionItem.displayName = 'SelectionItem';

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
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = JSON.parse(args);
        setToolArgs(AIToolsArgsSchema[AITool.SetTextFormats].safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[SetTextFormats] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const icon = <FormatPaintIcon />;

    const formats = toolArgs?.success ? toolArgs.data?.formats : undefined;
    const hasMultipleSelections = formats && formats.length > 1;

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

    // For single selection, show all items
    const fullDescription = useMemo(() => {
      if (formattingItems.length === 0) return undefined;
      return <FormatItemsDisplay items={formattingItems} />;
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

    const handleSelectEntry = useCallback((entry: FormatEntry) => {
      try {
        const sheetId = entry.sheet_name
          ? (sheets.getSheetByName(entry.sheet_name)?.id ?? sheets.current)
          : sheets.current;
        const selection = sheets.stringToSelection(entry.selection, sheetId);
        sheets.changeSelection(selection);
      } catch (e) {
        console.warn('Failed to select range:', e);
      }
    }, []);

    if (loading) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact hideIcon={hideIcon} />;
    }

    if (!!toolArgs && !toolArgs.success) {
      return <ToolCard icon={icon} label={label} hasError className={className} compact hideIcon={hideIcon} />;
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact hideIcon={hideIcon} />;
    }

    // For single selection, use the simple ToolCard with full description
    if (!hasMultipleSelections) {
      return (
        <ToolCard
          icon={icon}
          label={label}
          description={fullDescription}
          className={className}
          compact
          onClick={handleClick}
          hideIcon={hideIcon}
        />
      );
    }

    // For multiple selections, render expandable list
    return (
      <div className={cn('flex flex-col', className)}>
        <div
          className="flex cursor-pointer select-none items-center gap-1.5 text-sm text-muted-foreground hover:text-muted-foreground/80"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {!hideIcon && <FormatPaintIcon />}
          <span>{label}</span>
          {isExpanded ? (
            <ChevronDownIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </div>

        {isExpanded && formats && (
          <div className="ml-[7px] mt-1 flex flex-col gap-1 border-l-2 border-muted-foreground/20 pl-3">
            {formats.map((entry) => (
              <SelectionItem
                key={`${entry.sheet_name ?? ''}-${entry.selection}`}
                entry={entry}
                onSelect={handleSelectEntry}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
);
SetTextFormats.displayName = 'SetTextFormats';
