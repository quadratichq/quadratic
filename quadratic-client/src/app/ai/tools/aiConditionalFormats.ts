import { sheets } from '@/app/grid/controller/Sheets';
import type { Sheet } from '@/app/grid/sheet/Sheet';
import { getA1Notation } from '@/app/gridGL/UI/gridHeadings/getA1Notation';
import type {
  A1Selection,
  ColorScale,
  ColorScaleThreshold,
  ColorScaleThresholdValueType,
  ConditionalFormatClient,
  ConditionalFormatRule,
  ConditionalFormatStyle,
  ConditionalFormatUpdate,
} from '@/app/quadratic-core-types';
import { conditionalFormatRuleToFormula } from '@/app/quadratic-core/quadratic_core';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import type { AITool, AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';

const getSheetFromSheetName = (sheetName: string | null | undefined): Sheet | undefined => {
  return sheetName ? sheets.getSheetByName(sheetName) : sheets.sheet;
};

const convertRuleToText = (rule: ConditionalFormatRule): string => {
  if (rule === 'IsEmpty') return 'is empty (ISBLANK)';
  if (rule === 'IsNotEmpty') return 'is not empty (NOT(ISBLANK))';
  if ('TextContains' in rule) return `text contains "${rule.TextContains.value}"`;
  if ('TextNotContains' in rule) return `text does not contain "${rule.TextNotContains.value}"`;
  if ('TextStartsWith' in rule) return `text starts with "${rule.TextStartsWith.value}"`;
  if ('TextEndsWith' in rule) return `text ends with "${rule.TextEndsWith.value}"`;
  if ('TextIsExactly' in rule) return `text is exactly "${rule.TextIsExactly.value}"`;
  if ('GreaterThan' in rule) return `greater than ${formatValue(rule.GreaterThan.value)}`;
  if ('GreaterThanOrEqual' in rule) return `greater than or equal to ${formatValue(rule.GreaterThanOrEqual.value)}`;
  if ('LessThan' in rule) return `less than ${formatValue(rule.LessThan.value)}`;
  if ('LessThanOrEqual' in rule) return `less than or equal to ${formatValue(rule.LessThanOrEqual.value)}`;
  if ('IsEqualTo' in rule) return `equals ${formatValue(rule.IsEqualTo.value)}`;
  if ('IsNotEqualTo' in rule) return `does not equal ${formatValue(rule.IsNotEqualTo.value)}`;
  if ('IsBetween' in rule) return `between ${formatValue(rule.IsBetween.min)} and ${formatValue(rule.IsBetween.max)}`;
  if ('IsNotBetween' in rule)
    return `not between ${formatValue(rule.IsNotBetween.min)} and ${formatValue(rule.IsNotBetween.max)}`;
  if ('Custom' in rule) return `custom formula: ${rule.Custom.formula}`;
  return 'unknown rule';
};

const formatValue = (
  value: { Number: number } | { Text: string } | { CellRef: string } | { Bool: boolean }
): string => {
  if ('Number' in value) return value.Number.toString();
  if ('Text' in value) return `"${value.Text}"`;
  if ('CellRef' in value) return value.CellRef;
  if ('Bool' in value) return value.Bool.toString();
  return 'unknown';
};

const convertStyleToText = (style: ConditionalFormatStyle): string => {
  const parts: string[] = [];
  if (style.bold === true) parts.push('bold');
  if (style.italic === true) parts.push('italic');
  if (style.underline === true) parts.push('underline');
  if (style.strike_through === true) parts.push('strikethrough');
  if (style.text_color) parts.push(`text color: ${style.text_color}`);
  if (style.fill_color) parts.push(`fill color: ${style.fill_color}`);
  return parts.length > 0 ? parts.join(', ') : 'no style changes';
};

const convertConditionalFormatToText = (cf: ConditionalFormatClient, sheetId: string): string => {
  const selectionString = sheets.A1SelectionToA1String(cf.selection, sheetId);
  let response = `- ID: ${cf.id}\n`;
  response += `  Selection: ${selectionString}\n`;

  if (cf.config.type === 'Formula') {
    response += `  Rule: ${convertRuleToText(cf.config.rule)}\n`;
    response += `  Style: ${convertStyleToText(cf.config.style)}\n`;
  } else if (cf.config.type === 'ColorScale') {
    const colors = cf.config.color_scale.thresholds.map((t) => t.color).join(' → ');
    response += `  Type: Color Scale (${colors})\n`;
    if (cf.config.color_scale.invert_text_on_dark) {
      response += `  Auto-contrast text: enabled\n`;
    }
  }

  response += `  Apply to empty cells: ${cf.apply_to_blank}\n`;
  return response;
};

export const getConditionalFormatsToolCall = (sheetName: string): string => {
  const sheet = getSheetFromSheetName(sheetName);
  if (!sheet) {
    return `Sheet "${sheetName}" not found.`;
  }
  const conditionalFormats = sheet.conditionalFormats;

  if (conditionalFormats.length === 0) {
    return `Sheet "${sheet.name}" has no conditional formatting rules.`;
  }

  let response = `Sheet "${sheet.name}" has ${conditionalFormats.length} conditional formatting rule(s):\n\n`;
  conditionalFormats.forEach((cf) => {
    response += convertConditionalFormatToText(cf, sheet.id);
    response += '\n';
  });
  return response;
};

type ConditionalFormatAction = AIToolsArgs[AITool.UpdateConditionalFormats]['rules'][number];

export const updateConditionalFormatsToolCall = async (
  args: AIToolsArgs[AITool.UpdateConditionalFormats]
): Promise<string> => {
  const sheet = getSheetFromSheetName(args.sheet_name);
  if (!sheet) {
    return `Error: Sheet "${args.sheet_name}" not found.`;
  }

  const updates: ConditionalFormatUpdate[] = [];
  const deleteIds: string[] = [];
  const results: string[] = [];
  const errors: string[] = [];

  // Process all rules and collect updates/deletes
  for (const rule of args.rules) {
    try {
      const processed = processConditionalFormatRule(rule, sheet);
      if (processed.type === 'update') {
        updates.push(processed.update);
        results.push(processed.message);
      } else if (processed.type === 'delete') {
        deleteIds.push(processed.id);
        results.push(processed.message);
      }
    } catch (e) {
      errors.push(`Error processing rule: ${e}`);
    }
  }

  // Execute all operations in a single batch call
  if (updates.length > 0 || deleteIds.length > 0) {
    const response = await quadraticCore.batchUpdateConditionalFormats(sheet.id, updates, deleteIds);
    if (!response?.result) {
      const errorMsg = response?.error ?? 'Unknown error executing batch update';
      if (errors.length > 0) {
        return `Batch operation failed: ${errorMsg}\n\nAdditional validation errors:\n${errors.join('\n')}`;
      }
      return `Error: ${errorMsg}`;
    }
  }

  if (errors.length > 0) {
    return `Completed with validation errors:\n${results.join('\n')}\n\nErrors:\n${errors.join('\n')}`;
  }

  if (results.length === 0) {
    return 'No operations to perform.';
  }

  return results.join('\n');
};

type ProcessedRule =
  | { type: 'update'; update: ConditionalFormatUpdate; message: string }
  | { type: 'delete'; id: string; message: string };

// Convert AI color scale threshold to internal format
const convertAIThresholdToInternal = (
  aiThreshold: NonNullable<ConditionalFormatAction['color_scale_thresholds']>[number]
): ColorScaleThreshold => {
  let value_type: ColorScaleThresholdValueType;

  switch (aiThreshold.value_type) {
    case 'min':
      value_type = 'Min';
      break;
    case 'max':
      value_type = 'Max';
      break;
    case 'number':
      value_type = { Number: aiThreshold.value ?? 0 };
      break;
    case 'percent':
      value_type = { Percent: aiThreshold.value ?? 50 };
      break;
    case 'percentile':
      value_type = { Percentile: aiThreshold.value ?? 50 };
      break;
    default:
      value_type = 'Min';
  }

  return {
    value_type,
    color: aiThreshold.color,
  };
};

// Convert AI color scale thresholds to internal format
const convertAIColorScaleThresholdsToInternal = (
  aiThresholds: NonNullable<ConditionalFormatAction['color_scale_thresholds']>,
  autoContrastText?: boolean | null
): ColorScale => {
  return {
    thresholds: aiThresholds.map(convertAIThresholdToInternal),
    invert_text_on_dark: autoContrastText ?? false,
  };
};

const processConditionalFormatRule = (rule: ConditionalFormatAction, sheet: Sheet): ProcessedRule => {
  const {
    action,
    id,
    selection,
    type: formatType,
    rule: ruleFormula,
    apply_to_empty,
    color_scale_thresholds,
    auto_contrast_text,
    ...styleProps
  } = rule;

  // Determine if this is a color scale format
  const isColorScale = formatType === 'color_scale' || (color_scale_thresholds && !ruleFormula);

  switch (action) {
    case 'delete': {
      if (!id) {
        throw new Error('Delete action requires an id');
      }
      return { type: 'delete', id, message: `Deleted conditional format with ID: ${id}` };
    }

    case 'create': {
      if (!selection) {
        throw new Error('Create action requires a selection');
      }

      if (isColorScale) {
        // Color scale format
        if (!color_scale_thresholds || color_scale_thresholds.length < 2) {
          throw new Error(
            'Color scale create action requires color_scale_thresholds with at least 2 thresholds (e.g., min and max)'
          );
        }

        const internalColorScale = convertAIColorScaleThresholdsToInternal(color_scale_thresholds, auto_contrast_text);

        const update: ConditionalFormatUpdate = {
          id: null,
          sheet_id: sheet.id,
          selection,
          config: {
            type: 'ColorScale',
            color_scale: internalColorScale,
          },
          apply_to_blank: apply_to_empty ?? null,
        };

        const colors = internalColorScale.thresholds.map((t) => t.color).join(' → ');
        return { type: 'update', update, message: `Created color scale (${colors}) for selection "${selection}"` };
      } else {
        // Formula-based format
        if (!ruleFormula) {
          throw new Error('Formula-based create action requires a rule formula');
        }

        const style = buildStyle(styleProps);
        if (isEmptyStyle(style)) {
          throw new Error(
            'Formula-based create action requires at least one style property (bold, italic, underline, strike_through, text_color, or fill_color)'
          );
        }

        const update: ConditionalFormatUpdate = {
          id: null,
          sheet_id: sheet.id,
          selection,
          config: {
            type: 'Formula',
            rule: ruleFormula,
            style,
          },
          apply_to_blank: apply_to_empty ?? null,
        };

        return { type: 'update', update, message: `Created conditional format for selection "${selection}"` };
      }
    }

    case 'update': {
      if (!id) {
        throw new Error('Update action requires an id');
      }

      // Find existing conditional format
      const existing = sheet.conditionalFormats.find((cf) => cf.id === id);
      if (!existing) {
        throw new Error(`Conditional format with ID "${id}" not found`);
      }

      const existingSelection = sheets.A1SelectionToA1String(existing.selection, sheet.id);

      if (existing.config.type === 'ColorScale') {
        // Update color scale format
        const existingColorScale = existing.config.color_scale;
        const newColorScale = color_scale_thresholds
          ? convertAIColorScaleThresholdsToInternal(color_scale_thresholds, auto_contrast_text)
          : {
              ...existingColorScale,
              invert_text_on_dark:
                auto_contrast_text !== undefined
                  ? (auto_contrast_text ?? false)
                  : existingColorScale.invert_text_on_dark,
            };

        const update: ConditionalFormatUpdate = {
          id,
          sheet_id: sheet.id,
          selection: selection ?? existingSelection,
          config: {
            type: 'ColorScale',
            color_scale: newColorScale,
          },
          apply_to_blank: apply_to_empty !== undefined ? apply_to_empty : existing.apply_to_blank,
        };

        return { type: 'update', update, message: `Updated color scale with ID: ${id}` };
      } else {
        // Update formula-based format
        const style = buildStyle(styleProps, existing.config.style);

        const update: ConditionalFormatUpdate = {
          id,
          sheet_id: sheet.id,
          selection: selection ?? existingSelection,
          config: {
            type: 'Formula',
            rule: ruleFormula ?? getExistingRuleFormula(existing),
            style,
          },
          apply_to_blank: apply_to_empty !== undefined ? apply_to_empty : existing.apply_to_blank,
        };

        return { type: 'update', update, message: `Updated conditional format with ID: ${id}` };
      }
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
};

const buildStyle = (
  styleProps: Omit<
    ConditionalFormatAction,
    'id' | 'action' | 'selection' | 'type' | 'rule' | 'apply_to_empty' | 'color_scale_thresholds'
  >,
  existing?: ConditionalFormatStyle
): ConditionalFormatStyle => {
  return {
    bold: styleProps.bold !== undefined ? styleProps.bold : (existing?.bold ?? null),
    italic: styleProps.italic !== undefined ? styleProps.italic : (existing?.italic ?? null),
    underline: styleProps.underline !== undefined ? styleProps.underline : (existing?.underline ?? null),
    strike_through:
      styleProps.strike_through !== undefined ? styleProps.strike_through : (existing?.strike_through ?? null),
    text_color: styleProps.text_color !== undefined ? styleProps.text_color : (existing?.text_color ?? null),
    fill_color: styleProps.fill_color !== undefined ? styleProps.fill_color : (existing?.fill_color ?? null),
  };
};

const isEmptyStyle = (style: ConditionalFormatStyle): boolean => {
  return (
    style.bold === null &&
    style.italic === null &&
    style.underline === null &&
    style.strike_through === null &&
    style.text_color === null &&
    style.fill_color === null
  );
};

// Get the first cell (anchor) from an A1Selection for formula generation
const getAnchorCellFromSelection = (selection: A1Selection): string => {
  try {
    const jsSelection = sheets.A1SelectionToJsSelection(selection);
    const firstRangeStart = jsSelection.getFirstRangeStart(sheets.jsA1Context);
    jsSelection.free();
    if (firstRangeStart) {
      return getA1Notation(Number(firstRangeStart.x), Number(firstRangeStart.y));
    }
  } catch {
    // If conversion fails, fall back to cursor
  }
  // Fall back to cursor position
  return getA1Notation(Number(selection.cursor.x), Number(selection.cursor.y));
};

const getExistingRuleFormula = (cf: ConditionalFormatClient): string => {
  // Only formula-based configs have rules
  if (cf.config.type !== 'Formula') {
    return 'TRUE()';
  }

  // Get the anchor cell from the selection
  const anchor = getAnchorCellFromSelection(cf.selection);

  // Use the Rust WASM function to convert the rule to a formula string
  try {
    return conditionalFormatRuleToFormula(JSON.stringify(cf.config.rule), anchor);
  } catch {
    // Fallback if WASM function fails
    return 'TRUE()';
  }
};
