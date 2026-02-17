import { editorInteractionStateShowConditionalFormatAtom } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { getA1Notation } from '@/app/gridGL/UI/gridHeadings/getA1Notation';
import type { A1Selection, ColorScaleThreshold, ConditionalFormatRule } from '@/app/quadratic-core-types';
import { checkFormula, type JsSelection } from '@/app/quadratic-core/quadratic_core';
import { SheetRange } from '@/app/ui/components/SheetRange';
import { ColorScaleEditor } from '@/app/ui/menus/ConditionalFormatting/ConditionalFormat/ColorScaleEditor';
import { ConditionalFormatHeader } from '@/app/ui/menus/ConditionalFormatting/ConditionalFormat/ConditionalFormatHeader';
import { ConditionalFormatStyleToolbar } from '@/app/ui/menus/ConditionalFormatting/ConditionalFormat/ConditionalFormatStyleToolbar';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Button } from '@/shared/shadcn/ui/button';
import { Checkbox } from '@/shared/shadcn/ui/checkbox';
import { Input } from '@/shared/shadcn/ui/input';
import { Label } from '@/shared/shadcn/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/shared/shadcn/ui/select';
import { cn } from '@/shared/shadcn/utils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

// Format type for the conditional format
type FormatType = 'formula' | 'colorScale';

// Debounce delay for preview updates (ms)
const PREVIEW_DEBOUNCE_MS = 150;

export interface ConditionalFormatStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike_through?: boolean;
  text_color?: string;
  fill_color?: string;
}

// Condition types for the dropdown
type ConditionType =
  // Cell conditions
  | 'is_empty'
  | 'is_not_empty'
  // Text conditions
  | 'text_contains'
  | 'text_not_contains'
  | 'text_starts_with'
  | 'text_ends_with'
  | 'text_is_exactly'
  // Date conditions
  | 'date_is'
  | 'date_is_before'
  | 'date_is_after'
  // Number conditions
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'is_equal_to'
  | 'is_not_equal_to'
  | 'is_between'
  | 'is_not_between'
  // Custom
  | 'custom_formula';

const CONDITION_OPTIONS: { value: ConditionType; label: string; group?: string }[] = [
  // Cell conditions
  { value: 'is_empty', label: 'Is empty', group: 'cell' },
  { value: 'is_not_empty', label: 'Is not empty', group: 'cell' },
  // Text conditions
  { value: 'text_contains', label: 'Text contains', group: 'text' },
  { value: 'text_not_contains', label: 'Text does not contain', group: 'text' },
  { value: 'text_starts_with', label: 'Text starts with', group: 'text' },
  { value: 'text_ends_with', label: 'Text ends with', group: 'text' },
  { value: 'text_is_exactly', label: 'Text is exactly', group: 'text' },
  // Date conditions
  { value: 'date_is', label: 'Date is', group: 'date' },
  { value: 'date_is_before', label: 'Date is before', group: 'date' },
  { value: 'date_is_after', label: 'Date is after', group: 'date' },
  // Number conditions
  { value: 'greater_than', label: 'Greater than', group: 'number' },
  { value: 'greater_than_or_equal', label: 'Greater than or equal to', group: 'number' },
  { value: 'less_than', label: 'Less than', group: 'number' },
  { value: 'less_than_or_equal', label: 'Less than or equal to', group: 'number' },
  { value: 'is_equal_to', label: 'Is equal to', group: 'number' },
  { value: 'is_not_equal_to', label: 'Is not equal to', group: 'number' },
  { value: 'is_between', label: 'Is between', group: 'number' },
  { value: 'is_not_between', label: 'Is not between', group: 'number' },
  // Custom
  { value: 'custom_formula', label: 'Custom formula is TRUE', group: 'custom' },
];

// Helper to determine what inputs are needed for each condition type
const getInputType = (condition: ConditionType): 'none' | 'single' | 'double' | 'formula' => {
  switch (condition) {
    case 'is_empty':
    case 'is_not_empty':
      return 'none';
    case 'is_between':
    case 'is_not_between':
      return 'double';
    case 'custom_formula':
      return 'formula';
    default:
      return 'single';
  }
};

// Helper to determine if the condition type requires number input
const isNumberCondition = (condition: ConditionType): boolean => {
  return [
    'greater_than',
    'greater_than_or_equal',
    'less_than',
    'less_than_or_equal',
    'is_equal_to',
    'is_not_equal_to',
    'is_between',
    'is_not_between',
  ].includes(condition);
};

// Helper to get the default apply_to_blank value for a condition type.
// IsEmpty and IsNotEmpty should default to true (they're specifically about blank cells).
// All other conditions default to false (blank coerces to 0 which is often surprising).
const getDefaultApplyToBlank = (condition: ConditionType): boolean => {
  return condition === 'is_empty' || condition === 'is_not_empty';
};

// Helper to extract the display string from a ConditionalFormatValue
const formatValueToString = (value: { Number?: number; Text?: string; CellRef?: string; Bool?: boolean }): string => {
  if ('Number' in value && value.Number !== undefined) {
    return String(value.Number);
  }
  if ('Text' in value && value.Text !== undefined) {
    return value.Text;
  }
  if ('CellRef' in value && value.CellRef !== undefined) {
    return value.CellRef;
  }
  if ('Bool' in value && value.Bool !== undefined) {
    return value.Bool ? 'TRUE' : 'FALSE';
  }
  return '';
};

// Parse a ConditionalFormatRule from the server back into the UI condition type and values
const parseRuleToCondition = (
  rule: ConditionalFormatRule
): { conditionType: ConditionType; value1: string; value2: string } => {
  // The rule is a tagged union from Rust's serde
  // String variants: "IsEmpty", "IsNotEmpty"
  // Object variants: { "GreaterThan": { "value": { "Number": 5 } } }

  // Handle string variants
  if (rule === 'IsEmpty') {
    return { conditionType: 'is_empty', value1: '', value2: '' };
  }
  if (rule === 'IsNotEmpty') {
    return { conditionType: 'is_not_empty', value1: '', value2: '' };
  }

  // Handle object variants
  if (typeof rule === 'object') {
    if ('TextContains' in rule) {
      return { conditionType: 'text_contains', value1: rule.TextContains.value, value2: '' };
    }
    if ('TextNotContains' in rule) {
      return { conditionType: 'text_not_contains', value1: rule.TextNotContains.value, value2: '' };
    }
    if ('TextStartsWith' in rule) {
      return { conditionType: 'text_starts_with', value1: rule.TextStartsWith.value, value2: '' };
    }
    if ('TextEndsWith' in rule) {
      return { conditionType: 'text_ends_with', value1: rule.TextEndsWith.value, value2: '' };
    }
    if ('TextIsExactly' in rule) {
      return { conditionType: 'text_is_exactly', value1: rule.TextIsExactly.value, value2: '' };
    }
    if ('GreaterThan' in rule) {
      return { conditionType: 'greater_than', value1: formatValueToString(rule.GreaterThan.value), value2: '' };
    }
    if ('GreaterThanOrEqual' in rule) {
      return {
        conditionType: 'greater_than_or_equal',
        value1: formatValueToString(rule.GreaterThanOrEqual.value),
        value2: '',
      };
    }
    if ('LessThan' in rule) {
      return { conditionType: 'less_than', value1: formatValueToString(rule.LessThan.value), value2: '' };
    }
    if ('LessThanOrEqual' in rule) {
      return {
        conditionType: 'less_than_or_equal',
        value1: formatValueToString(rule.LessThanOrEqual.value),
        value2: '',
      };
    }
    if ('IsEqualTo' in rule) {
      return { conditionType: 'is_equal_to', value1: formatValueToString(rule.IsEqualTo.value), value2: '' };
    }
    if ('IsNotEqualTo' in rule) {
      return { conditionType: 'is_not_equal_to', value1: formatValueToString(rule.IsNotEqualTo.value), value2: '' };
    }
    if ('IsBetween' in rule) {
      return {
        conditionType: 'is_between',
        value1: formatValueToString(rule.IsBetween.min),
        value2: formatValueToString(rule.IsBetween.max),
      };
    }
    if ('IsNotBetween' in rule) {
      return {
        conditionType: 'is_not_between',
        value1: formatValueToString(rule.IsNotBetween.min),
        value2: formatValueToString(rule.IsNotBetween.max),
      };
    }
    if ('Custom' in rule) {
      return { conditionType: 'custom_formula', value1: rule.Custom.formula, value2: '' };
    }
  }

  // Fallback for unknown rule types
  return { conditionType: 'custom_formula', value1: '', value2: '' };
};

// Escape double quotes in strings for formula generation (double them)
const escapeFormulaString = (str: string): string => {
  return str.replace(/"/g, '""');
};

// Wrap a value in quotes for formula string literals
const quoteString = (str: string): string => {
  return `"${escapeFormulaString(str)}"`;
};

// Check if a value looks like a number
const isNumericValue = (value: string): boolean => {
  if (value.trim() === '') return false;
  return !isNaN(Number(value)) && isFinite(Number(value));
};

// Check if a value looks like a cell reference (e.g., A1, $B$2, Sheet1!A1)
const isCellReference = (value: string): boolean => {
  // Match cell references like A1, $A$1, Sheet1!A1, 'Sheet Name'!A1
  const cellRefPattern = /^('?[^']*'?!)?(\$?[A-Za-z]+\$?\d+|\$?[A-Za-z]+:\$?[A-Za-z]+|\$?\d+:\$?\d+)$/;
  return cellRefPattern.test(value.trim());
};

// Check if a value is a boolean
const isBooleanValue = (value: string): boolean => {
  const upper = value.trim().toUpperCase();
  return upper === 'TRUE' || upper === 'FALSE';
};

// Smart quote: only quote if it's a plain text value (not number, cell ref, or boolean)
const smartQuote = (value: string): string => {
  if (isNumericValue(value) || isCellReference(value) || isBooleanValue(value)) {
    return value;
  }
  return quoteString(value);
};

// Generate formula based on condition type and values
const generateFormula = (condition: ConditionType, cellRef: string, value1: string, value2: string): string => {
  // For text-specific conditions, always quote
  const quotedValue1 = quoteString(value1);
  // For general comparisons, use smart quoting
  const smartValue1 = smartQuote(value1);
  const smartValue2 = smartQuote(value2);

  switch (condition) {
    case 'is_empty':
      return `ISBLANK(${cellRef})`;
    case 'is_not_empty':
      return `NOT(ISBLANK(${cellRef}))`;
    case 'text_contains':
      return `ISNUMBER(SEARCH(${quotedValue1}, ${cellRef}))`;
    case 'text_not_contains':
      return `ISERROR(SEARCH(${quotedValue1}, ${cellRef}))`;
    case 'text_starts_with':
      return `LEFT(${cellRef}, ${value1.length}) = ${quotedValue1}`;
    case 'text_ends_with':
      return `RIGHT(${cellRef}, ${value1.length}) = ${quotedValue1}`;
    case 'text_is_exactly':
      return `${cellRef} = ${quotedValue1}`;
    case 'date_is':
      return `${cellRef} = ${value1}`;
    case 'date_is_before':
      return `${cellRef} < ${value1}`;
    case 'date_is_after':
      return `${cellRef} > ${value1}`;
    case 'greater_than':
      return `${cellRef} > ${smartValue1}`;
    case 'greater_than_or_equal':
      return `${cellRef} >= ${smartValue1}`;
    case 'less_than':
      return `${cellRef} < ${smartValue1}`;
    case 'less_than_or_equal':
      return `${cellRef} <= ${smartValue1}`;
    case 'is_equal_to':
      return `${cellRef} = ${smartValue1}`;
    case 'is_not_equal_to':
      return `${cellRef} <> ${smartValue1}`;
    case 'is_between':
      return `AND(${cellRef} >= ${smartValue1}, ${cellRef} <= ${smartValue2})`;
    case 'is_not_between':
      return `OR(${cellRef} < ${smartValue1}, ${cellRef} > ${smartValue2})`;
    case 'custom_formula':
      return value1;
    default:
      return '';
  }
};

export const ConditionalFormat = () => {
  const showConditionalFormat = useRecoilValue(editorInteractionStateShowConditionalFormatAtom);
  const setShowConditionalFormat = useSetRecoilState(editorInteractionStateShowConditionalFormatAtom);
  const isNew = showConditionalFormat === 'new';
  const sheetId = sheets.current;

  // Find existing conditional format when editing
  const existingFormat = useMemo(() => {
    if (isNew || !showConditionalFormat) return undefined;
    return sheets.sheet.conditionalFormats.find((cf) => cf.id === showConditionalFormat);
  }, [isNew, showConditionalFormat]);

  // Get initial selection from current cursor for new rules, or from existing format
  const initialSelection = useMemo((): A1Selection | undefined => {
    if (existingFormat) {
      return existingFormat.selection;
    }
    if (isNew) {
      return sheets.sheet.cursor.selection();
    }
    return undefined;
  }, [isNew, existingFormat]);

  const [selection, setSelection] = useState<JsSelection | undefined>(undefined);

  // Determine initial format type from existing format
  const [formatType, setFormatType] = useState<FormatType>(() => {
    if (existingFormat?.config.type === 'ColorScale') {
      return 'colorScale';
    }
    return 'formula';
  });

  const [conditionType, setConditionType] = useState<ConditionType>(() => {
    // For editing, start with custom formula since we store the raw formula
    return existingFormat?.config.type === 'Formula' ? 'custom_formula' : 'greater_than';
  });
  const [value1, setValue1] = useState('');
  const [value2, setValue2] = useState('');
  const [customFormula, setCustomFormula] = useState('');
  const [style, setStyle] = useState<ConditionalFormatStyle>(() => {
    if (existingFormat?.config.type === 'Formula') {
      return { ...existingFormat.config.style };
    }
    return {};
  });

  // Color scale state
  const [colorScaleThresholds, setColorScaleThresholds] = useState<ColorScaleThreshold[]>(() => {
    if (existingFormat?.config.type === 'ColorScale') {
      return [...existingFormat.config.color_scale.thresholds];
    }
    // Default: Traffic Light (red → yellow → green)
    return [
      { value_type: 'Min', color: '#ef4444' },
      { value_type: { Percentile: 50 }, color: '#facc15' },
      { value_type: 'Max', color: '#22c55e' },
    ];
  });

  const [invertTextOnDark, setInvertTextOnDark] = useState<boolean>(() => {
    if (existingFormat?.config.type === 'ColorScale') {
      return existingFormat.config.color_scale.invert_text_on_dark ?? false;
    }
    return false;
  });

  const [applyToBlank, setApplyToBlank] = useState<boolean>(() => {
    // Use existing value if editing, otherwise use the default based on condition type
    return existingFormat?.apply_to_blank ?? false;
  });
  const [triggerError, setTriggerError] = useState(false);

  // Load rule and style from existing format when editing
  useEffect(() => {
    if (existingFormat) {
      // Determine format type from config
      if (existingFormat.config.type === 'ColorScale') {
        setFormatType('colorScale');
        setColorScaleThresholds([...existingFormat.config.color_scale.thresholds]);
        setInvertTextOnDark(existingFormat.config.color_scale.invert_text_on_dark ?? false);
      } else if (existingFormat.config.type === 'Formula') {
        setFormatType('formula');
        // Update the rule/formula state
        if (existingFormat.config.rule) {
          const result = parseRuleToCondition(existingFormat.config.rule);
          setConditionType(result.conditionType);
          setValue1(result.value1);
          setValue2(result.value2);
          if (result.conditionType === 'custom_formula') {
            setCustomFormula(result.value1);
          }
        }
        // Update the style state (convert null to undefined)
        setStyle({
          bold: existingFormat.config.style.bold ?? undefined,
          italic: existingFormat.config.style.italic ?? undefined,
          underline: existingFormat.config.style.underline ?? undefined,
          strike_through: existingFormat.config.style.strike_through ?? undefined,
          text_color: existingFormat.config.style.text_color ?? undefined,
          fill_color: existingFormat.config.style.fill_color ?? undefined,
        });
      }
      // Update apply_to_blank
      setApplyToBlank(existingFormat.apply_to_blank);
    }
  }, [existingFormat]);

  // Get the first cell from the selection for the formula generation.
  // This uses the start of the first range, not the cursor, to correctly
  // handle table column selections where the cursor may not be at the first data cell.
  const firstCell = useMemo(() => {
    // Try to get from JsSelection first (if user has changed the selection)
    if (selection) {
      const firstRangeStart = selection.getFirstRangeStart(sheets.jsA1Context);
      if (firstRangeStart) {
        return getA1Notation(Number(firstRangeStart.x), Number(firstRangeStart.y));
      }
      // Fall back to cursor if no first range start available
      const sel = selection.selection();
      return getA1Notation(Number(sel.cursor.x), Number(sel.cursor.y));
    }
    // Fall back to initial selection - need to convert to JsSelection to get first range start
    if (initialSelection) {
      try {
        const jsSelection = sheets.A1SelectionToJsSelection(initialSelection);
        const firstRangeStart = jsSelection.getFirstRangeStart(sheets.jsA1Context);
        jsSelection.free();
        if (firstRangeStart) {
          return getA1Notation(Number(firstRangeStart.x), Number(firstRangeStart.y));
        }
      } catch {
        // If conversion fails, fall back to cursor
      }
      return getA1Notation(Number(initialSelection.cursor.x), Number(initialSelection.cursor.y));
    }
    return 'A1';
  }, [selection, initialSelection]);

  // Get the position for formula validation (first cell in selection)
  // This uses the start of the first range, not the cursor, to correctly
  // handle table column selections.
  const formulaPosition = useMemo(() => {
    if (selection) {
      const firstRangeStart = selection.getFirstRangeStart(sheets.jsA1Context);
      if (firstRangeStart) {
        return { x: Number(firstRangeStart.x), y: Number(firstRangeStart.y) };
      }
      const sel = selection.selection();
      return { x: Number(sel.cursor.x), y: Number(sel.cursor.y) };
    }
    if (initialSelection) {
      try {
        const jsSelection = sheets.A1SelectionToJsSelection(initialSelection);
        const firstRangeStart = jsSelection.getFirstRangeStart(sheets.jsA1Context);
        jsSelection.free();
        if (firstRangeStart) {
          return { x: Number(firstRangeStart.x), y: Number(firstRangeStart.y) };
        }
      } catch {
        // If conversion fails, fall back to cursor
      }
      return { x: Number(initialSelection.cursor.x), y: Number(initialSelection.cursor.y) };
    }
    return { x: 0, y: 0 };
  }, [selection, initialSelection]);

  // Generate the formula based on current condition
  const generatedFormula = useMemo(() => {
    const inputType = getInputType(conditionType);
    if (inputType === 'formula') {
      return customFormula;
    }
    return generateFormula(conditionType, firstCell, value1, value2);
  }, [conditionType, firstCell, value1, value2, customFormula]);

  // Validate the formula using the WASM parser
  const formulaValidation = useMemo((): { isValid: boolean; error?: string } => {
    if (!generatedFormula.trim()) {
      return { isValid: false, error: 'Formula is required' };
    }

    try {
      const isValid = checkFormula(generatedFormula, sheets.jsA1Context, sheetId, formulaPosition.x, formulaPosition.y);
      if (!isValid) {
        return { isValid: false, error: 'Invalid formula syntax' };
      }
      return { isValid: true };
    } catch (e) {
      return { isValid: false, error: e instanceof Error ? e.message : 'Invalid formula' };
    }
  }, [generatedFormula, sheetId, formulaPosition]);

  const inputType = getInputType(conditionType);

  // Check if required values are filled in
  const hasValidValues = useMemo(() => {
    switch (inputType) {
      case 'none':
        return true;
      case 'single':
        return value1.trim() !== '';
      case 'double':
        return value1.trim() !== '' && value2.trim() !== '';
      case 'formula':
        return customFormula.trim() !== '';
      default:
        return false;
    }
  }, [inputType, value1, value2, customFormula]);

  // Check if at least one style option is selected
  const hasAnyStyle = useMemo(() => {
    return !!(
      style.bold ||
      style.italic ||
      style.underline ||
      style.strike_through ||
      style.text_color ||
      style.fill_color
    );
  }, [style]);

  // Track the preview timeout for debouncing
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the last sent preview JSON to avoid sending duplicates
  const lastPreviewJsonRef = useRef<string | null>(null);
  // Track whether we have an active preview (to know if we need to clear it)
  const hasActivePreviewRef = useRef(false);

  // Check if color scale is valid
  const hasValidColorScale = useMemo(() => {
    return colorScaleThresholds.length >= 2;
  }, [colorScaleThresholds]);

  // Send preview to core when form values change (debounced)
  useEffect(() => {
    // Clear any pending preview update
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }

    // Validation depends on format type
    const isFormulaValid = formatType === 'formula' && hasValidValues && formulaValidation.isValid && hasAnyStyle;
    const isColorScaleValid = formatType === 'colorScale' && hasValidColorScale;

    // Don't send preview if required values are missing
    if (!selection || (!isFormulaValid && !isColorScaleValid)) {
      // Only clear the preview if we had previously sent one
      if (hasActivePreviewRef.current) {
        quadraticCore.clearPreviewConditionalFormat(sheetId);
        hasActivePreviewRef.current = false;
        lastPreviewJsonRef.current = null;
      }
      return;
    }

    // Build the preview object based on format type
    const selectionJson = selection.toA1String(sheetId, sheets.jsA1Context);
    const config =
      formatType === 'colorScale'
        ? {
            type: 'ColorScale' as const,
            color_scale: {
              thresholds: colorScaleThresholds,
              invert_text_on_dark: invertTextOnDark,
            },
          }
        : {
            type: 'Formula' as const,
            rule: generatedFormula,
            style: {
              bold: style.bold ?? null,
              italic: style.italic ?? null,
              underline: style.underline ?? null,
              strike_through: style.strike_through ?? null,
              text_color: style.text_color ?? null,
              fill_color: style.fill_color ?? null,
            },
          };

    const previewData = {
      id: existingFormat?.id ?? null,
      sheet_id: sheetId,
      selection: selectionJson,
      config,
      apply_to_blank: applyToBlank,
    };

    // Check if preview data actually changed
    const previewJson = JSON.stringify(previewData);
    if (previewJson === lastPreviewJsonRef.current) {
      return; // Nothing changed, don't send
    }

    // Debounce the preview update
    previewTimeoutRef.current = setTimeout(() => {
      lastPreviewJsonRef.current = previewJson;
      hasActivePreviewRef.current = true;
      quadraticCore.previewConditionalFormat(previewData);
    }, PREVIEW_DEBOUNCE_MS);
  }, [
    selection,
    existingFormat?.id,
    formatType,
    generatedFormula,
    hasValidValues,
    formulaValidation.isValid,
    hasAnyStyle,
    hasValidColorScale,
    style,
    colorScaleThresholds,
    invertTextOnDark,
    applyToBlank,
    sheetId,
  ]);

  // Clean up preview on unmount
  useEffect(() => {
    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
      // Only clear if we had an active preview
      if (hasActivePreviewRef.current) {
        quadraticCore.clearPreviewConditionalFormat(sheetId);
      }
    };
  }, [sheetId]);

  const applyConditionalFormat = useCallback(() => {
    if (!selection) {
      setTriggerError(true);
      return;
    }

    // For formula type, validate the formula
    if (formatType === 'formula' && (!hasValidValues || !formulaValidation.isValid)) {
      return;
    }

    // For color scale, validate thresholds
    if (formatType === 'colorScale' && colorScaleThresholds.length < 2) {
      return;
    }

    // Clear the preview first so it doesn't interfere with the real format
    quadraticCore.clearPreviewConditionalFormat(sheetId);

    // Get the selection as a JSON string for the backend
    const selectionJson = selection.toA1String(sheetId, sheets.jsA1Context);

    // Build the config based on format type
    const config =
      formatType === 'colorScale'
        ? {
            type: 'ColorScale' as const,
            color_scale: {
              thresholds: colorScaleThresholds,
              invert_text_on_dark: invertTextOnDark,
            },
          }
        : {
            type: 'Formula' as const,
            rule: generatedFormula,
            style: {
              bold: style.bold ?? null,
              italic: style.italic ?? null,
              underline: style.underline ?? null,
              strike_through: style.strike_through ?? null,
              text_color: style.text_color ?? null,
              fill_color: style.fill_color ?? null,
            },
          };

    quadraticCore.updateConditionalFormat({
      id: existingFormat?.id ?? null,
      sheet_id: sheetId,
      selection: selectionJson,
      config,
      apply_to_blank: applyToBlank,
    });

    setShowConditionalFormat(true);
  }, [
    selection,
    existingFormat?.id,
    formatType,
    generatedFormula,
    hasValidValues,
    formulaValidation.isValid,
    style,
    colorScaleThresholds,
    invertTextOnDark,
    applyToBlank,
    sheetId,
    setShowConditionalFormat,
  ]);

  const cancel = useCallback(() => {
    // Clear the preview when canceling (also handled by unmount cleanup)
    quadraticCore.clearPreviewConditionalFormat(sheetId);
    setShowConditionalFormat(true);
  }, [sheetId, setShowConditionalFormat]);

  // Group the options for rendering with separators
  const renderConditionOptions = () => {
    const groups = ['cell', 'text', 'date', 'number', 'custom'];
    const elements: React.ReactNode[] = [];

    groups.forEach((group, groupIndex) => {
      const groupOptions = CONDITION_OPTIONS.filter((opt) => opt.group === group);
      groupOptions.forEach((option) => {
        elements.push(
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        );
      });
      if (groupIndex < groups.length - 1) {
        elements.push(<SelectSeparator key={`sep-${group}`} />);
      }
    });

    return elements;
  };

  return (
    <div
      className="border-gray relative flex h-full shrink-0 flex-col border-l bg-background px-3 text-sm"
      style={{ width: '20rem' }}
      data-testid="conditional-format-edit-panel"
    >
      <ConditionalFormatHeader isNew={isNew} />

      <div className="flex flex-grow flex-col gap-5 overflow-y-auto p-1">
        <SheetRange
          label="Apply to range"
          initial={initialSelection}
          onChangeSelection={setSelection}
          triggerError={triggerError}
          changeCursor={true}
          readOnly={false}
          onlyCurrentSheet={sheetId}
          onlyCurrentSheetError="Range must be on the same sheet"
        />

        {/* Format Type Selector */}
        <div>
          <Label>Format type</Label>
          <Select value={formatType} onValueChange={(value) => setFormatType(value as FormatType)}>
            <SelectTrigger className="mt-1 w-full">
              <SelectValue placeholder="Select format type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="formula">Style and color</SelectItem>
              <SelectItem value="colorScale">Color scale</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {formatType === 'formula' && (
          <>
            <div>
              <Label>Format cells if…</Label>
              <Select
                value={conditionType}
                onValueChange={(v) => {
                  const newConditionType = v as ConditionType;
                  setConditionType(newConditionType);
                  // Update apply_to_blank to the default for this condition type (only for new rules)
                  if (isNew) {
                    setApplyToBlank(getDefaultApplyToBlank(newConditionType));
                  }
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>{renderConditionOptions()}</SelectContent>
              </Select>
            </div>

            {/* Show value inputs based on condition type */}
            {inputType === 'single' && (
              <div>
                <Label htmlFor="value1">Value</Label>
                <Input
                  id="value1"
                  type={isNumberCondition(conditionType) ? 'number' : 'text'}
                  value={value1}
                  onChange={(e) => setValue1(e.target.value)}
                  placeholder={conditionType.startsWith('text_') ? 'Enter text' : 'Enter number'}
                  className="mt-1"
                />
              </div>
            )}

            {inputType === 'double' && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="value1">From</Label>
                  <Input
                    id="value1"
                    type="number"
                    value={value1}
                    onChange={(e) => setValue1(e.target.value)}
                    placeholder="Min"
                    className="mt-1"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="value2">To</Label>
                  <Input
                    id="value2"
                    type="number"
                    value={value2}
                    onChange={(e) => setValue2(e.target.value)}
                    placeholder="Max"
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {inputType === 'formula' && (
              <div>
                <Label htmlFor="formula">Custom formula</Label>
                <Input
                  id="formula"
                  value={customFormula}
                  onChange={(e) => setCustomFormula(e.target.value)}
                  placeholder={`e.g., ${firstCell} > 10`}
                  className={cn('mt-1', !formulaValidation.isValid && customFormula && 'border-destructive')}
                />
                {!formulaValidation.isValid && customFormula ? (
                  <p className="mt-1 text-xs text-destructive">{formulaValidation.error}</p>
                ) : (
                  <>
                    <p className="mt-1 text-xs text-muted-foreground">Enter a formula that returns TRUE or FALSE.</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Cell references will adjust for each cell in the selection, similar to copying a formula.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Show generated formula preview for non-custom conditions */}
            {inputType !== 'formula' && generatedFormula && (
              <div
                className={cn(
                  'rounded px-3 py-2 text-xs',
                  formulaValidation.isValid ? 'bg-muted text-muted-foreground' : 'bg-destructive/10 text-destructive'
                )}
              >
                <span className="font-medium">Formula: </span>
                <code>{generatedFormula}</code>
                {!formulaValidation.isValid && <p className="mt-1">{formulaValidation.error}</p>}
              </div>
            )}

            {/* Apply to blank cells checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="apply-to-blank"
                checked={applyToBlank}
                onCheckedChange={(checked) => setApplyToBlank(checked === true)}
              />
              <Label htmlFor="apply-to-blank" className="cursor-pointer text-sm font-normal">
                Apply to empty cells
              </Label>
            </div>

            <div>
              <Label>Formatting style</Label>
              <ConditionalFormatStyleToolbar style={style} setStyle={setStyle} />
              <StylePreview style={style} />
            </div>
          </>
        )}

        {/* Color Scale Editor */}
        {formatType === 'colorScale' && (
          <ColorScaleEditor
            thresholds={colorScaleThresholds}
            setThresholds={setColorScaleThresholds}
            invertTextOnDark={invertTextOnDark}
            setInvertTextOnDark={setInvertTextOnDark}
          />
        )}
      </div>

      <div className="mt-3 flex w-full justify-between border-t border-t-gray-100 py-3">
        <div>
          {!isNew && existingFormat && (
            <Button
              variant="secondary"
              onClick={() => {
                quadraticCore.removeConditionalFormat(sheetId, existingFormat.id);
                setShowConditionalFormat(true);
              }}
            >
              Remove Rule
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={cancel}>
            Cancel
          </Button>
          <Button
            onClick={applyConditionalFormat}
            disabled={
              formatType === 'formula'
                ? !hasValidValues || !formulaValidation.isValid || !hasAnyStyle
                : !hasValidColorScale
            }
          >
            {isNew ? 'Add' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
};

const StylePreview = ({ style }: { style: ConditionalFormatStyle }) => {
  const hasAnyStyle =
    style.bold || style.italic || style.underline || style.strike_through || style.text_color || style.fill_color;

  return (
    <div
      className="mt-2 rounded border border-border px-3 py-2"
      style={{
        backgroundColor: style.fill_color ?? undefined,
      }}
    >
      <span
        style={{
          fontWeight: style.bold ? 'bold' : undefined,
          fontStyle: style.italic ? 'italic' : undefined,
          textDecoration:
            [style.underline ? 'underline' : '', style.strike_through ? 'line-through' : '']
              .filter(Boolean)
              .join(' ') || undefined,
          color: style.text_color ?? undefined,
        }}
      >
        {hasAnyStyle ? 'Sample Text' : 'Select a style above'}
      </span>
    </div>
  );
};
