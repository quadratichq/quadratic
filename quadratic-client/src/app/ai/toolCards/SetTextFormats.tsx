import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { sheets } from '@/app/grid/controller/Sheets';
import {
  CurrencyIcon,
  FormatAlignCenterIcon,
  FormatAlignLeftIcon,
  FormatAlignRightIcon,
  FormatBoldIcon,
  FormatColorFillIcon,
  FormatColorTextIcon,
  FormatDateTimeIcon,
  FormatFontSizeIcon,
  FormatItalicIcon,
  FormatPaintIcon,
  FormatStrikethroughIcon,
  FormatTextWrapIcon,
  FormatToggleCommasIcon,
  FormatUnderlinedIcon,
  PercentIcon,
  VerticalAlignBottomIcon,
  VerticalAlignMiddleIcon,
  VerticalAlignTopIcon,
} from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { z } from 'zod';

type SetTextFormatsResponse = z.infer<(typeof aiToolsSpec)[AITool.SetTextFormats]['responseSchema']>;

interface FormatItem {
  icon: React.ReactNode;
  label: string;
  colorSwatch?: string;
}

function getFormattingItems(data: SetTextFormatsResponse): FormatItem[] {
  const items: FormatItem[] = [];

  if (data.bold === true) items.push({ icon: <FormatBoldIcon className="text-xs" />, label: 'Bold' });
  if (data.italic === true) items.push({ icon: <FormatItalicIcon className="text-xs" />, label: 'Italic' });
  if (data.underline === true) items.push({ icon: <FormatUnderlinedIcon className="text-xs" />, label: 'Underline' });
  if (data.strike_through === true)
    items.push({ icon: <FormatStrikethroughIcon className="text-xs" />, label: 'Strikethrough' });
  if (data.text_color)
    items.push({
      icon: <FormatColorTextIcon className="text-xs" />,
      label: data.text_color,
      colorSwatch: data.text_color,
    });
  if (data.fill_color)
    items.push({
      icon: <FormatColorFillIcon className="text-xs" />,
      label: data.fill_color,
      colorSwatch: data.fill_color,
    });
  if (data.align === 'left') items.push({ icon: <FormatAlignLeftIcon className="text-xs" />, label: 'Left' });
  if (data.align === 'center') items.push({ icon: <FormatAlignCenterIcon className="text-xs" />, label: 'Center' });
  if (data.align === 'right') items.push({ icon: <FormatAlignRightIcon className="text-xs" />, label: 'Right' });
  if (data.vertical_align === 'top') items.push({ icon: <VerticalAlignTopIcon className="text-xs" />, label: 'Top' });
  if (data.vertical_align === 'middle')
    items.push({ icon: <VerticalAlignMiddleIcon className="text-xs" />, label: 'Middle' });
  if (data.vertical_align === 'bottom')
    items.push({ icon: <VerticalAlignBottomIcon className="text-xs" />, label: 'Bottom' });
  if (data.wrap) items.push({ icon: <FormatTextWrapIcon className="text-xs" />, label: data.wrap });
  if (data.numeric_commas === true)
    items.push({ icon: <FormatToggleCommasIcon className="text-xs" />, label: 'Commas' });
  if (data.number_type === 'percentage') items.push({ icon: <PercentIcon className="text-xs" />, label: 'Percent' });
  if (data.number_type === 'currency' || data.currency_symbol)
    items.push({ icon: <CurrencyIcon className="text-xs" />, label: data.currency_symbol || 'Currency' });
  if (data.date_time) items.push({ icon: <FormatDateTimeIcon className="text-xs" />, label: data.date_time });
  if (data.font_size !== undefined && data.font_size !== null)
    items.push({ icon: <FormatFontSizeIcon className="text-xs" />, label: `${data.font_size}pt` });

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
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {formattingItems.map((item, index) => (
            <span key={index} className="inline-flex items-center gap-0.5">
              {item.icon}
              {item.colorSwatch ? (
                <span
                  className="inline-block h-3 w-3 rounded-sm border border-border"
                  style={{ backgroundColor: item.colorSwatch }}
                />
              ) : (
                <span>{item.label}</span>
              )}
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
