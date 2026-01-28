import { editorInteractionStateShowConditionalFormatAtom } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import type {
  ConditionalFormatClient,
  ConditionalFormatRule,
  ConditionalFormatValue,
} from '@/app/quadratic-core-types';
import { ConditionalFormatsHeader } from '@/app/ui/menus/ConditionalFormatting/ConditionalFormats/ConditionalFormatsHeader';
import { useConditionalFormatsData } from '@/app/ui/menus/ConditionalFormatting/ConditionalFormats/useConditionalFormatsData';
import { DeleteIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { useCallback } from 'react';
import { useSetRecoilState } from 'recoil';

// Helper to format a ConditionalFormatValue for display
const formatValue = (value: ConditionalFormatValue): string => {
  if ('Number' in value) return String(value.Number);
  if ('Text' in value) return `"${value.Text}"`;
  if ('CellRef' in value) return value.CellRef;
  if ('Bool' in value) return value.Bool ? 'TRUE' : 'FALSE';
  return '';
};

// Convert a ConditionalFormatRule to a human-readable summary
const getRuleSummary = (rule: ConditionalFormatRule): string => {
  if (rule === 'IsEmpty') return 'Cell is empty';
  if (rule === 'IsNotEmpty') return 'Cell is not empty';
  if ('TextContains' in rule) return `Text contains "${rule.TextContains.value}"`;
  if ('TextNotContains' in rule) return `Text doesn't contain "${rule.TextNotContains.value}"`;
  if ('TextStartsWith' in rule) return `Text starts with "${rule.TextStartsWith.value}"`;
  if ('TextEndsWith' in rule) return `Text ends with "${rule.TextEndsWith.value}"`;
  if ('TextIsExactly' in rule) return `Text is exactly "${rule.TextIsExactly.value}"`;
  if ('GreaterThan' in rule) return `Greater than ${formatValue(rule.GreaterThan.value)}`;
  if ('GreaterThanOrEqual' in rule) return `Greater than or equal to ${formatValue(rule.GreaterThanOrEqual.value)}`;
  if ('LessThan' in rule) return `Less than ${formatValue(rule.LessThan.value)}`;
  if ('LessThanOrEqual' in rule) return `Less than or equal to ${formatValue(rule.LessThanOrEqual.value)}`;
  if ('IsEqualTo' in rule) return `Equal to ${formatValue(rule.IsEqualTo.value)}`;
  if ('IsNotEqualTo' in rule) return `Not equal to ${formatValue(rule.IsNotEqualTo.value)}`;
  if ('IsBetween' in rule) return `Between ${formatValue(rule.IsBetween.min)} and ${formatValue(rule.IsBetween.max)}`;
  if ('IsNotBetween' in rule)
    return `Not between ${formatValue(rule.IsNotBetween.min)} and ${formatValue(rule.IsNotBetween.max)}`;
  if ('Custom' in rule) return `Formula: ${rule.Custom.formula}`;
  return 'Unknown rule';
};

export const ConditionalFormats = () => {
  const setShowConditionalFormat = useSetRecoilState(editorInteractionStateShowConditionalFormatAtom);
  const { conditionalFormats, deleteConditionalFormat, removeAllConditionalFormats, readOnly } =
    useConditionalFormatsData();

  const addConditionalFormat = useCallback(() => {
    setShowConditionalFormat('new');
  }, [setShowConditionalFormat]);

  const editConditionalFormat = useCallback(
    (id: string) => {
      setShowConditionalFormat(id);
    },
    [setShowConditionalFormat]
  );

  return (
    <div
      className="border-gray relative flex h-full shrink-0 flex-col border-l bg-background px-3 text-sm"
      style={{ width: '20rem' }}
      data-testid="conditional-format-panel"
    >
      <ConditionalFormatsHeader />

      <div className="grow overflow-auto">
        <div className="flex flex-col gap-2 py-2">
          {conditionalFormats.map((cf) => (
            <ConditionalFormatItem
              key={cf.id}
              conditionalFormat={cf}
              onEdit={() => editConditionalFormat(cf.id)}
              onDelete={() => deleteConditionalFormat(cf.id)}
              readOnly={readOnly}
            />
          ))}
        </div>
      </div>

      {!readOnly && (
        <div className="flex w-full items-center justify-center gap-3 border-t border-t-gray-100 py-3">
          <Button variant="secondary" onClick={removeAllConditionalFormats}>
            Remove All
          </Button>
          <Button onClick={addConditionalFormat} autoFocus>
            Add Rule
          </Button>
        </div>
      )}
    </div>
  );
};

interface ConditionalFormatItemProps {
  conditionalFormat: ConditionalFormatClient;
  onEdit: () => void;
  onDelete: () => void;
  readOnly: boolean;
}

const ConditionalFormatItem = ({ conditionalFormat, onEdit, onDelete, readOnly }: ConditionalFormatItemProps) => {
  // Convert A1Selection to a display string
  let selectionString = 'Unknown range';
  if (conditionalFormat.selection) {
    try {
      const jsSelection = sheets.A1SelectionToJsSelection(conditionalFormat.selection);
      // Pass the current sheet ID so the sheet name isn't included
      // (conditional formats are limited to the current sheet)
      selectionString = jsSelection.toA1String(sheets.current, sheets.jsA1Context);
      jsSelection.free();
    } catch {
      selectionString = 'Unknown range';
    }
  }

  // Get rule summary based on config type
  const ruleSummary =
    conditionalFormat.config.type === 'Formula' ? getRuleSummary(conditionalFormat.config.rule) : 'Color Scale';

  // Get style from config (only for formula-based)
  const style = conditionalFormat.config.type === 'Formula' ? conditionalFormat.config.style : null;

  // Get color scale gradient for preview (only for color scale)
  const colorScaleGradient =
    conditionalFormat.config.type === 'ColorScale'
      ? `linear-gradient(to right, ${conditionalFormat.config.color_scale.thresholds.map((t) => t.color).join(', ')})`
      : undefined;

  return (
    <div
      className="group flex cursor-pointer items-center gap-2 rounded border border-border p-2 transition-colors hover:bg-accent"
      onClick={readOnly ? undefined : onEdit}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{selectionString}</div>
        <div className="truncate text-xs text-muted-foreground">{ruleSummary}</div>
      </div>

      {/* Style preview for formula-based */}
      {style && (
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded border text-xs',
            style.bold && 'font-bold',
            style.italic && 'italic',
            style.underline && 'underline',
            style.strike_through && 'line-through'
          )}
          style={{
            backgroundColor: style.fill_color ?? undefined,
            color: style.text_color ?? undefined,
          }}
        >
          Aa
        </div>
      )}

      {/* Gradient preview for color scale */}
      {colorScaleGradient && (
        <div
          className="h-8 w-8 shrink-0 rounded border"
          style={{ background: colorScaleGradient }}
          title="Color Scale"
        />
      )}

      {!readOnly && (
        <TooltipPopover label="Delete" side="bottom">
          <Button
            variant="ghost"
            size="icon-sm"
            className="opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <DeleteIcon />
          </Button>
        </TooltipPopover>
      )}
    </div>
  );
};
