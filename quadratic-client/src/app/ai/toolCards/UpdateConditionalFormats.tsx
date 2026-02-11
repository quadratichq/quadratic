import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { editorInteractionStateShowConditionalFormatAtom } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { FormatPaintIcon } from '@/shared/components/Icons';
import { cn } from '@/shared/shadcn/utils';
import { ChevronDownIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useSetRecoilState } from 'recoil';
import type { z } from 'zod';

type UpdateConditionalFormatsResponse = z.infer<
  (typeof aiToolsSpec)[AITool.UpdateConditionalFormats]['responseSchema']
>;
type RuleEntry = UpdateConditionalFormatsResponse['rules'][number];

// Get action badge color
const getActionColor = (action: string): string => {
  switch (action) {
    case 'create':
      return 'text-green-600';
    case 'update':
      return 'text-blue-600';
    case 'delete':
      return 'text-red-600';
    default:
      return 'text-muted-foreground';
  }
};

// Get style summary for display
const getStyleSummary = (rule: RuleEntry): string => {
  // Check if this is a color scale
  if (rule.type === 'color_scale' && rule.color_scale_thresholds) {
    const colors = rule.color_scale_thresholds.map((t) => t.color).join(' → ');
    return `color scale: ${colors}`;
  }

  // Formula-based format
  const parts: string[] = [];
  if (rule.bold) parts.push('bold');
  if (rule.italic) parts.push('italic');
  if (rule.underline) parts.push('underline');
  if (rule.strike_through) parts.push('strike');
  if (rule.text_color) parts.push(`text: ${rule.text_color}`);
  if (rule.fill_color) parts.push(`fill: ${rule.fill_color}`);
  return parts.length > 0 ? parts.join(', ') : '';
};

// Individual rule item that can be clicked to navigate
const RuleItem = memo(
  ({
    rule,
    sheetName,
    onSelect,
  }: {
    rule: RuleEntry;
    sheetName: string;
    onSelect: (rule: RuleEntry, sheetName: string) => void;
  }) => {
    const styleSummary = useMemo(() => getStyleSummary(rule), [rule]);

    const displayText = useMemo(() => {
      if (rule.action === 'delete') {
        return rule.id ? `ID: ${rule.id.slice(0, 8)}...` : 'unknown';
      }
      return rule.selection ?? 'unknown selection';
    }, [rule]);

    return (
      <div
        className="flex cursor-pointer items-center gap-1 text-sm text-muted-foreground hover:text-foreground/80"
        onClick={() => onSelect(rule, sheetName)}
      >
        <span className={cn('shrink-0 font-medium', getActionColor(rule.action))}>{rule.action}</span>
        <span className="text-muted-foreground/60">•</span>
        <span className="shrink-0">{displayText}</span>
        {styleSummary && (
          <>
            <span className="text-muted-foreground/60">•</span>
            <span className="min-w-0 truncate text-muted-foreground/80">{styleSummary}</span>
          </>
        )}
      </div>
    );
  }
);
RuleItem.displayName = 'RuleItem';

export const UpdateConditionalFormats = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const setShowConditionalFormat = useSetRecoilState(editorInteractionStateShowConditionalFormatAtom);
    const [toolArgs, setToolArgs] =
      useState<z.SafeParseReturnType<UpdateConditionalFormatsResponse, UpdateConditionalFormatsResponse>>();
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = args ? JSON.parse(args) : {};
        setToolArgs(aiToolsSpec[AITool.UpdateConditionalFormats].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[UpdateConditionalFormats] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const rules = toolArgs?.success ? toolArgs.data?.rules : undefined;
    const hasMultipleRules = rules && rules.length > 1;

    const { label, description } = useMemo(() => {
      if (!toolArgs?.data?.rules) {
        return {
          label: loading ? 'Applying conditional formatting' : 'Applied conditional formatting',
          description: undefined,
        };
      }

      const rules = toolArgs.data.rules;
      const createCount = rules.filter((r) => r.action === 'create').length;
      const updateCount = rules.filter((r) => r.action === 'update').length;
      const deleteCount = rules.filter((r) => r.action === 'delete').length;

      const parts: string[] = [];
      if (createCount > 0) parts.push(`${createCount} created`);
      if (updateCount > 0) parts.push(`${updateCount} updated`);
      if (deleteCount > 0) parts.push(`${deleteCount} deleted`);

      const verb = loading ? 'Applying' : 'Applied';

      if (rules.length === 1) {
        const rule = rules[0];
        const actionText = rule.action === 'delete' ? 'Deleted' : verb;
        const selectionText = rule.selection ?? (rule.id ? `ID: ${rule.id.slice(0, 8)}...` : '');
        return {
          label: `${actionText} conditional format${selectionText ? ` for ${selectionText}` : ''}`,
          description: getStyleSummary(rule) || undefined,
        };
      }

      return {
        label: `${verb} ${rules.length} conditional format rules`,
        description: parts.length > 0 ? parts.join(', ') : undefined,
      };
    }, [toolArgs?.data, loading]);

    const handleClick = useCallback(() => {
      if (!toolArgs?.success || !toolArgs.data) return;

      const { sheet_name, rules } = toolArgs.data;

      // Navigate to the sheet if needed
      const sheet = sheets.getSheetByName(sheet_name);
      if (sheet && sheet.id !== sheets.current) {
        sheets.current = sheet.id;
      }

      // Find the first rule with an ID (update action) or selection (create action)
      const ruleWithId = rules.find((r) => r.action === 'update' && r.id);
      const ruleWithSelection = rules.find((r) => (r.action === 'create' || r.action === 'update') && r.selection);

      // If we have a rule with an ID that still exists, open it for editing
      if (ruleWithId?.id && sheet) {
        const existingRule = sheet.conditionalFormats.find((cf) => cf.id === ruleWithId.id);
        if (existingRule) {
          // Highlight the selection
          try {
            const jsSelection = sheets.A1SelectionToJsSelection(existingRule.selection);
            sheets.changeSelection(jsSelection);
          } catch (e) {
            console.warn('Failed to select conditional format range:', e);
          }
          // Open the specific rule for editing
          setShowConditionalFormat(ruleWithId.id);
          return;
        }
      }

      // If we have a selection from a create/update rule, try to highlight it
      if (ruleWithSelection?.selection && sheet) {
        try {
          const selection = sheets.stringToSelection(ruleWithSelection.selection, sheet.id);
          sheets.changeSelection(selection);
        } catch (e) {
          console.warn('Failed to select range:', e);
        }
      }

      // Open the conditional format panel (list view)
      setShowConditionalFormat(true);
    }, [toolArgs, setShowConditionalFormat]);

    const handleSelectRule = useCallback(
      (rule: RuleEntry, sheetName: string) => {
        const sheet = sheets.getSheetByName(sheetName) ?? sheets.sheet;

        // Helper to get the formula from a stored conditional format config
        const getStoredFormula = (cf: (typeof sheet.conditionalFormats)[number]): string | undefined => {
          if (cf.config.type !== 'Formula') return undefined;
          const cfRule = cf.config.rule;
          if (typeof cfRule === 'object' && 'Custom' in cfRule) {
            return cfRule.Custom.formula;
          }
          return undefined;
        };

        // Helper to get style from a conditional format (only for formula-based)
        const getStyle = (cf: (typeof sheet.conditionalFormats)[number]) => {
          if (cf.config.type !== 'Formula') return null;
          return cf.config.style;
        };

        // Helper to check if selection strings match
        const selectionsMatch = (cf: (typeof sheet.conditionalFormats)[number]): boolean => {
          if (!rule.selection) return false;
          try {
            const jsSelection = sheets.A1SelectionToJsSelection(cf.selection);
            const cfSelectionString = jsSelection.toA1String(sheet.id, sheets.jsA1Context);
            jsSelection.free();
            return cfSelectionString === rule.selection;
          } catch {
            return false;
          }
        };

        // Helper to check if styles match
        const stylesMatch = (cf: (typeof sheet.conditionalFormats)[number]): boolean => {
          const cfStyle = getStyle(cf);
          if (!cfStyle) return false;
          // Compare all style properties
          return (
            (rule.bold === undefined || rule.bold === null || cfStyle.bold === rule.bold) &&
            (rule.italic === undefined || rule.italic === null || cfStyle.italic === rule.italic) &&
            (rule.underline === undefined || rule.underline === null || cfStyle.underline === rule.underline) &&
            (rule.strike_through === undefined ||
              rule.strike_through === null ||
              cfStyle.strike_through === rule.strike_through) &&
            (rule.text_color === undefined || rule.text_color === null || cfStyle.text_color === rule.text_color) &&
            (rule.fill_color === undefined || rule.fill_color === null || cfStyle.fill_color === rule.fill_color)
          );
        };

        // Helper to check if styles match exactly (for when we need precise matching)
        // Normalizes undefined/null to be equivalent for comparison
        const stylesMatchExact = (cf: (typeof sheet.conditionalFormats)[number]): boolean => {
          const cfStyle = getStyle(cf);
          if (!cfStyle) return false;
          // Normalize undefined and null to be equivalent
          const normalize = (v: unknown): unknown => (v === undefined || v === null ? null : v);
          return (
            normalize(cfStyle.bold) === normalize(rule.bold) &&
            normalize(cfStyle.italic) === normalize(rule.italic) &&
            normalize(cfStyle.underline) === normalize(rule.underline) &&
            normalize(cfStyle.strike_through) === normalize(rule.strike_through) &&
            normalize(cfStyle.text_color) === normalize(rule.text_color) &&
            normalize(cfStyle.fill_color) === normalize(rule.fill_color)
          );
        };

        // For update/create actions, try to find and open the specific rule
        if (rule.action === 'update' || rule.action === 'create') {
          let existingRule = rule.id ? sheet.conditionalFormats.find((cf) => cf.id === rule.id) : undefined;

          // If not found by ID, try to find by matching selection + formula + styles
          if (!existingRule && rule.selection && rule.rule) {
            existingRule = sheet.conditionalFormats.find((cf) => {
              const storedFormula = getStoredFormula(cf);
              const selMatch = selectionsMatch(cf);
              const formulaMatch = storedFormula === rule.rule;
              const styleMatch = stylesMatch(cf);
              return selMatch && formulaMatch && styleMatch;
            });
          }

          // If not found, try matching selection + formula (without style check)
          if (!existingRule && rule.selection && rule.rule) {
            existingRule = sheet.conditionalFormats.find((cf) => {
              const storedFormula = getStoredFormula(cf);
              return selectionsMatch(cf) && storedFormula === rule.rule;
            });
          }

          // If still not found, try matching selection + exact styles
          if (!existingRule && rule.selection) {
            existingRule = sheet.conditionalFormats.find((cf) => {
              const selMatch = selectionsMatch(cf);
              const styleMatch = stylesMatchExact(cf);
              return selMatch && styleMatch;
            });
          }

          // Last resort: selection only (may be ambiguous)
          if (!existingRule && rule.selection) {
            existingRule = sheet.conditionalFormats.find((cf) => selectionsMatch(cf));
          }

          if (existingRule) {
            // Highlight the selection
            try {
              const jsSelection = sheets.A1SelectionToJsSelection(existingRule.selection);
              sheets.changeSelection(jsSelection);
            } catch (e) {
              console.warn('Failed to select conditional format range:', e);
            }
            // Open the specific rule for editing
            setShowConditionalFormat(existingRule.id);
            return;
          }
        }

        // Try to highlight the selection from the rule args
        if (rule.selection && sheet) {
          try {
            const selection = sheets.stringToSelection(rule.selection, sheet.id);
            sheets.changeSelection(selection);
          } catch (e) {
            console.warn('Failed to select range:', e);
          }
        }

        // Open the conditional format panel (list view)
        setShowConditionalFormat(true);
      },
      [setShowConditionalFormat]
    );

    const icon = <FormatPaintIcon />;

    if (loading) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact />;
    }

    if (!!toolArgs && !toolArgs.success) {
      return (
        <ToolCard
          icon={icon}
          label={label}
          hasError
          description={toolArgs.error.message}
          className={className}
          compact
        />
      );
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact />;
    }

    // For single rule, use the simple ToolCard
    if (!hasMultipleRules) {
      return (
        <ToolCard
          icon={icon}
          label={label}
          description={description}
          className={className}
          compact
          onClick={handleClick}
        />
      );
    }

    // For multiple rules, render expandable list
    return (
      <div className={cn('flex flex-col', className)}>
        <div
          className="flex cursor-pointer select-none items-center gap-1.5 text-sm text-muted-foreground hover:text-muted-foreground/80"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <FormatPaintIcon />
          <span>{label}</span>
          {isExpanded ? (
            <ChevronDownIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </div>

        {isExpanded && rules && (
          <div className="ml-[7px] mt-1 flex flex-col gap-1 border-l-2 border-muted-foreground/20 pl-3">
            {rules.map((rule, index) => (
              <RuleItem
                key={`${rule.id ?? index}-${rule.action}-${rule.selection ?? ''}`}
                rule={rule}
                sheetName={toolArgs.data.sheet_name}
                onSelect={handleSelectRule}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
);
UpdateConditionalFormats.displayName = 'UpdateConditionalFormats';
