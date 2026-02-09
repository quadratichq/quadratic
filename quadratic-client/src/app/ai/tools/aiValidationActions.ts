import { bigIntReplacer } from '@/app/bigint';
import { sheets } from '@/app/grid/controller/Sheets';
import type { Sheet } from '@/app/grid/sheet/Sheet';
import type {
  A1Selection,
  DateTimeRange,
  NumberRange,
  TextMatch,
  Validation,
  ValidationListSource,
  ValidationUpdate,
} from '@/app/quadratic-core-types';
import { userDateToNumber, userTimeToNumber } from '@/app/quadratic-core/quadratic_core';
import { aiUser } from '@/app/web-workers/multiplayerWebWorker/aiUser';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { isNotUndefinedOrNull } from '@/shared/utils/undefined';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { AITool, type AIToolsArgs, AIToolsArgsSchema } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ToolResultContent } from 'quadratic-shared/typesAndSchemasAI';
import type { z } from 'zod';

// Helper functions for converting validations to text

const getMessageError = (validation: Validation) => {
  if (validation.message.show && (validation.message.title || validation.message.message)) {
    return ` - when user is in the cell, displays a message titled: "${validation.message.title}" with a message: "${validation.message.message}"\n`;
  }
  if (validation.error.show && (validation.error.title || validation.error.message)) {
    return ` - when there is an error, shows a message titled: "${validation.error.title}" with a message: "${validation.error.message}"\n`;
  }
  return '';
};

const getMessageLogical = (validation: Validation) => {
  if (validation.rule === 'None') return '';
  if ('Logical' in validation.rule) {
    return (
      ` - logical (true or false) validation\n` +
      ` - ${validation.rule.Logical.show_checkbox ? 'displays' : 'does not display'} a checkbox\n` +
      ` - ${validation.rule.Logical.ignore_blank ? 'allows' : 'does not allow'} blank messages.\n`
    );
  }
  return '';
};

const getMessageList = (validation: Validation, sheetId: string) => {
  if (validation.rule === 'None') return '';
  if ('List' in validation.rule) {
    return (
      ` - list validation\n` +
      ` - ${validation.rule.List.drop_down ? 'displays' : 'does not display'} a dropdown list\n` +
      ` - ${validation.rule.List.ignore_blank ? 'allows' : 'does not allow'} blank messages\n` +
      ('Selection' in validation.rule.List.source
        ? ` - uses values in the selection "${sheets.A1SelectionToA1String(validation.rule.List.source.Selection, sheetId)}"`
        : 'List' in validation.rule.List.source
          ? ` - uses values in the comma-separated list "${validation.rule.List.source.List.join(', ')}"`
          : '')
    );
  }
  return '';
};

const getMessageText = (validation: Validation) => {
  if (validation.rule === 'None') return '';
  if ('Text' in validation.rule) {
    const textMatchDescriptions = validation.rule.Text.text_match
      .map((textMatch) => {
        if ('Exactly' in textMatch) {
          if ('CaseSensitive' in textMatch.Exactly) {
            return ` - exactly (case sensitive): ${textMatch.Exactly.CaseSensitive.join(', ')}`;
          }
          return ` - exactly (case insensitive): ${textMatch.Exactly.CaseInsensitive.join(', ')}`;
        }
        if ('Contains' in textMatch) {
          if ('CaseSensitive' in textMatch.Contains) {
            return ` - contains (case sensitive): ${textMatch.Contains.CaseSensitive.join(', ')}`;
          }
          return ` - contains (case insensitive): ${textMatch.Contains.CaseInsensitive.join(', ')}`;
        }
        if ('NotContains' in textMatch) {
          if ('CaseSensitive' in textMatch.NotContains) {
            return ` - does not contain (case sensitive): ${textMatch.NotContains.CaseSensitive.join(', ')}`;
          }
          return ` - does not contain (case insensitive): ${textMatch.NotContains.CaseInsensitive.join(', ')}`;
        }
        if ('TextLength' in textMatch) {
          return ` - text length between ${textMatch.TextLength.min ?? 'no minimum'} and ${textMatch.TextLength.max ?? 'no maximum'}`;
        }
        return '';
      })
      .join('\n');

    return (
      ` - text validation\n` +
      ` - ${validation.rule.Text.ignore_blank ? 'allows' : 'does not allow'} blank messages\n` +
      textMatchDescriptions
    );
  }
  return '';
};

const getMessageNumber = (validation: Validation) => {
  if (validation.rule === 'None') return '';
  if ('Number' in validation.rule) {
    const rangeDescriptions = validation.rule.Number.ranges
      .map((range) => {
        if ('Range' in range) {
          const min = range.Range[0] !== null ? range.Range[0] : 'no minimum';
          const max = range.Range[1] !== null ? range.Range[1] : 'no maximum';
          return ` - range between ${min} and ${max}`;
        }
        if ('Equal' in range) {
          return ` - equals ${range.Equal.join(', ')}`;
        }
        if ('NotEqual' in range) {
          return ` - does not equal ${range.NotEqual.join(', ')}`;
        }
        return '';
      })
      .join(', ');

    return (
      ` - number validation\n` +
      ` - ${validation.rule.Number.ignore_blank ? 'allows' : 'does not allow'} blank messages\n` +
      rangeDescriptions
    );
  }
  return '';
};

const getMessageDateTime = (validation: Validation) => {
  if (validation.rule === 'None') return '';
  if ('DateTime' in validation.rule) {
    const rangeDescriptions = validation.rule.DateTime.ranges
      .map((range) => {
        if ('DateRange' in range) {
          const min = range.DateRange[0] !== null ? range.DateRange[0] : 'no minimum';
          const max = range.DateRange[1] !== null ? range.DateRange[1] : 'no maximum';
          return ` - date range between ${min} and ${max}`;
        }
        if ('DateEqual' in range) {
          return ` - date equals ${range.DateEqual.join(', ')}`;
        }
        if ('DateNotEqual' in range) {
          return ` - date does not equal ${range.DateNotEqual.join(', ')}`;
        }
        if ('TimeRange' in range) {
          const min = range.TimeRange[0] !== null ? range.TimeRange[0] : 'no minimum';
          const max = range.TimeRange[1] !== null ? range.TimeRange[1] : 'no maximum';
          return ` - time range between ${min} and ${max}`;
        }
        if ('TimeEqual' in range) {
          return ` - time equals ${range.TimeEqual.join(', ')}`;
        }
        if ('TimeNotEqual' in range) {
          return ` - time does not equal ${range.TimeNotEqual.join(', ')}`;
        }
        return '';
      })
      .join(', ');

    return (
      ` - date/time validation\n` +
      ` - ${validation.rule.DateTime.ignore_blank ? 'allows' : 'does not allow'} blank messages\n` +
      ` - ${validation.rule.DateTime.require_date ? 'requires' : 'does not require'} date\n` +
      ` - ${validation.rule.DateTime.require_time ? 'requires' : 'does not require'} time\n` +
      ` - ${validation.rule.DateTime.prohibit_date ? 'prohibits' : 'allows'} date\n` +
      ` - ${validation.rule.DateTime.prohibit_time ? 'prohibits' : 'allows'} time\n` +
      rangeDescriptions
    );
  }
  return '';
};

const convertValidationToText = (validation: Validation, sheetId: string): string => {
  let response = `This validation covers all cells in ${sheets.A1SelectionToA1String(validation.selection, sheetId)}:\n`;
  if (validation.rule === 'None') {
    response += getMessageError(validation);
  } else if ('Logical' in validation.rule) {
    response += getMessageLogical(validation) + getMessageError(validation);
  } else if ('List' in validation.rule) {
    response += getMessageList(validation, sheetId) + getMessageError(validation);
  } else if ('Text' in validation.rule) {
    response += getMessageText(validation) + getMessageError(validation);
  } else if ('Number' in validation.rule) {
    response += getMessageNumber(validation) + getMessageError(validation);
  } else if ('DateTime' in validation.rule) {
    response += getMessageDateTime(validation) + getMessageError(validation);
  }
  return response + '\n';
};

const getSelectionFromString = (selection: string, sheetId: string): A1Selection => {
  try {
    const a1SelectionJson = sheets.stringToSelection(selection, sheetId).save();
    return JSON.parse(a1SelectionJson, bigIntReplacer) as A1Selection;
  } catch (e) {
    throw new Error(`Invalid selection: ${selection}`);
  }
};

const getSheetFromSheetName = (sheetName: string | null | undefined): Sheet => {
  return sheetName ? (sheets.getSheetByName(sheetName) ?? sheets.sheet) : sheets.sheet;
};

const updateAICursorForSelection = (selection: string, sheetName: string | null | undefined): void => {
  try {
    const sheetId = sheetName
      ? (sheets.getSheetByName(sheetName)?.id ?? sheets.current)
      : sheets.current;
    const jsSelection = sheets.stringToSelection(selection, sheetId);
    const selectionString = jsSelection.save();
    aiUser.updateSelection(selectionString, sheetId);
  } catch (e) {
    console.warn('Failed to update AI user selection:', e);
  }
};

// Implementation functions

const getValidationsToolCall = (sheetName: string | null | undefined): string => {
  const sheet = sheetName ? (sheets.getSheetByName(sheetName) ?? sheets.sheet) : sheets.sheet;
  const validations = sheet.validations;

  if (validations.length === 0) {
    return `Sheet "${sheet.name}" has no validations.`;
  }

  let response = `Sheet "${sheet.name}" has the following validations:\n`;
  validations.forEach((validation) => {
    response += convertValidationToText(validation, sheet.id);
  });
  return response;
};

const addMessageToolCall = async (args: AIToolsArgs[AITool.AddMessage]): Promise<string> => {
  const sheet = getSheetFromSheetName(args.sheet_name);
  const validation: ValidationUpdate = {
    id: null,
    selection: getSelectionFromString(args.selection, sheet.id),
    rule: 'None',
    message: {
      show: true,
      title: args.message_title ?? '',
      message: args.message_text ?? '',
    },
    // we shouldn't have errors in a validation that is only a message
    error: {
      show: false,
      style: 'Stop',
      title: '',
      message: '',
    },
  };
  await quadraticCore.updateValidation(validation, true);
  return `Message successfully added to ${args.selection}`;
};

const addLogicalValidationToolCall = async (args: AIToolsArgs[AITool.AddLogicalValidation]): Promise<string> => {
  const sheet = getSheetFromSheetName(args.sheet_name);
  const validation: ValidationUpdate = {
    id: null,
    selection: getSelectionFromString(args.selection, sheet.id),
    rule: {
      Logical: {
        show_checkbox: args.show_checkbox ?? true,
        ignore_blank: args.ignore_blank ?? true,
      },
    },
    message: {
      show: true,
      title: args.message_title ?? '',
      message: args.message_text ?? '',
    },
    error: {
      show: args.show_error ?? true,
      style: args.error_style ?? 'Stop',
      title: args.error_title ?? '',
      message: args.error_message ?? '',
    },
  };
  await quadraticCore.updateValidation(validation, true);
  return `Logical validation successfully added to ${args.selection}`;
};

const addListValidationToolCall = async (args: AIToolsArgs[AITool.AddListValidation]): Promise<string> => {
  const sheet = getSheetFromSheetName(args.sheet_name);
  const source: ValidationListSource = args.list_source_selection
    ? {
        Selection: getSelectionFromString(args.list_source_selection, sheet.id),
      }
    : {
        List: args.list_source_list ? args.list_source_list.split(',').map((s) => s.trim()) : ([] as Array<string>),
      };
  const validation: ValidationUpdate = {
    id: null,
    selection: getSelectionFromString(args.selection, sheet.id),
    rule: {
      List: {
        drop_down: args.drop_down ?? false,
        ignore_blank: args.ignore_blank ?? true,
        source,
      },
    },
    message: {
      show: args.show_message ?? true,
      title: args.message_title ?? '',
      message: args.message_text ?? '',
    },
    error: {
      show: args.show_error ?? true,
      style: args.error_style ?? 'Stop',
      title: args.error_title ?? '',
      message: args.error_message ?? '',
    },
  };

  await quadraticCore.updateValidation(validation, true);
  return `List validation successfully added to ${args.selection}`;
};

const addTextValidationToolCall = async (args: AIToolsArgs[AITool.AddTextValidation]): Promise<string> => {
  const sheet = getSheetFromSheetName(args.sheet_name);
  const textMatch: Array<TextMatch> = [];
  if (isNotUndefinedOrNull(args.min_length) || isNotUndefinedOrNull(args.max_length)) {
    textMatch.push({
      TextLength: {
        min: args.min_length ?? null,
        max: args.max_length ?? null,
      },
    });
  }
  if (args.exactly_case_sensitive) {
    textMatch.push({
      Exactly: {
        CaseSensitive: args.exactly_case_sensitive.split(',').map((s) => s.trim()),
      },
    });
  }
  if (args.exactly_case_insensitive) {
    textMatch.push({
      Exactly: {
        CaseInsensitive: args.exactly_case_insensitive.split(',').map((s) => s.trim()),
      },
    });
  }
  if (args.contains_case_sensitive) {
    textMatch.push({
      Contains: {
        CaseSensitive: args.contains_case_sensitive.split(',').map((s) => s.trim()),
      },
    });
  }
  if (args.contains_case_insensitive) {
    textMatch.push({
      Contains: {
        CaseInsensitive: args.contains_case_insensitive.split(',').map((s) => s.trim()),
      },
    });
  }
  if (args.not_contains_case_sensitive) {
    textMatch.push({
      NotContains: {
        CaseSensitive: args.not_contains_case_sensitive.split(',').map((s) => s.trim()),
      },
    });
  }
  if (args.not_contains_case_insensitive) {
    textMatch.push({
      NotContains: {
        CaseInsensitive: args.not_contains_case_insensitive.split(',').map((s) => s.trim()),
      },
    });
  }
  if (textMatch.length === 0) {
    throw new Error('Need to provide matching rules for text validation.');
  }
  const validation: ValidationUpdate = {
    id: null,
    selection: getSelectionFromString(args.selection, sheet.id),
    rule: {
      Text: {
        ignore_blank: args.ignore_blank ?? true,
        text_match: textMatch,
      },
    },
    message: {
      show: args.show_message ?? true,
      title: args.message_title ?? '',
      message: args.message_text ?? '',
    },
    error: {
      show: args.show_error ?? true,
      style: args.error_style ?? 'Stop',
      title: args.error_title ?? '',
      message: args.error_message ?? '',
    },
  };
  await quadraticCore.updateValidation(validation, true);
  return `Text validation successfully added to ${args.selection}`;
};

const addNumberValidationToolCall = async (args: AIToolsArgs[AITool.AddNumberValidation]): Promise<string> => {
  const sheet = getSheetFromSheetName(args.sheet_name);
  const ranges: Array<NumberRange> = [];
  if (args.range) {
    args.range.split(',').forEach((s) => {
      if (s.includes('..')) {
        const [minString, maxString] = s.split('..');
        const min = minString === '' ? null : Number(minString);
        const max = maxString === '' ? null : Number(maxString);
        ranges.push({ Range: [min, max] });
      } else {
        throw new Error(`Invalid range: ${s}`);
      }
    });
  }
  if (args.equal) {
    ranges.push({
      Equal: args.equal.split(',').map((s) => {
        const n = Number(s.trim());
        if (isNaN(n)) throw new Error(`Invalid number: ${s}`);
        return n;
      }),
    });
  }
  if (args.not_equal) {
    ranges.push({
      NotEqual: args.not_equal.split(',').map((s) => {
        const n = Number(s.trim());
        if (isNaN(n)) throw new Error(`Invalid number: ${s}`);
        return n;
      }),
    });
  }
  const validation: ValidationUpdate = {
    id: null,
    selection: getSelectionFromString(args.selection, sheet.id),
    rule: {
      Number: {
        ignore_blank: args.ignore_blank ?? true,
        ranges,
      },
    },
    message: {
      show: args.show_message ?? true,
      title: args.message_title ?? '',
      message: args.message_text ?? '',
    },
    error: {
      show: args.show_error ?? true,
      style: args.error_style ?? 'Stop',
      title: args.error_title ?? '',
      message: args.error_message ?? '',
    },
  };
  await quadraticCore.updateValidation(validation, true);
  return `Number validation successfully added to ${args.selection}`;
};

const addDateTimeValidationToolCall = async (args: AIToolsArgs[AITool.AddDateTimeValidation]): Promise<string> => {
  const sheet = getSheetFromSheetName(args.sheet_name);
  const ranges: Array<DateTimeRange> = [];

  if (args.date_range) {
    args.date_range.split(',').forEach((s) => {
      if (s.includes('..')) {
        const [minString, maxString] = s.split('..');
        const min = minString === '' ? null : (userDateToNumber(minString) ?? null);
        const max = maxString === '' ? null : (userDateToNumber(maxString) ?? null);
        if (min !== undefined && isNaN(Number(min))) {
          throw new Error(`Expected date range to be defined in YYYY/MM/DD format, received: ${minString}`);
        }
        if (max !== undefined && isNaN(Number(max))) {
          throw new Error(`Expected date range to be defined in YYYY/MM/DD format, received: ${maxString}`);
        }
        ranges.push({ DateRange: [min, max] });
      } else {
        throw new Error(`Expected date range to be defined in YYYY/MM/DD..YYYY/MM/DD format, received: ${s}`);
      }
    });
  }
  if (args.date_equal) {
    args.date_equal.split(',').forEach((s) => {
      const date = userDateToNumber(s);
      if (date === undefined) {
        throw new Error(`Expected date to be defined in YYYY/MM/DD format, received: ${s}`);
      }
      ranges.push({ DateEqual: [date] });
    });
  }
  if (args.date_not_equal) {
    args.date_not_equal.split(',').forEach((s) => {
      const date = userDateToNumber(s);
      if (date === undefined) {
        throw new Error(`Expected date to be defined in YYYY/MM/DD format, received: ${s}`);
      }
      ranges.push({ DateNotEqual: [date] });
    });
  }
  if (args.time_range) {
    args.time_range.split(',').forEach((s) => {
      if (s.includes('..')) {
        const [minString, maxString] = s.split('..');
        const min = minString === '' ? null : (userTimeToNumber(minString) ?? null);
        const max = maxString === '' ? null : (userTimeToNumber(maxString) ?? null);
        if (min !== undefined && isNaN(Number(min))) {
          throw new Error(`Expected time range to be defined in HH:MM:SS format, received: ${minString}`);
        }
        if (max !== undefined && max === undefined) {
          throw new Error(`Expected time range to be defined in HH:MM:SS format, received: ${maxString}`);
        }
        ranges.push({ TimeRange: [min, max] });
      } else {
        throw new Error(`Expected time range to be defined in HH:MM:SS..HH:MM:SS format, received: ${s}`);
      }
    });
  }
  if (args.time_equal) {
    args.time_equal.split(',').forEach((s) => {
      const time = userTimeToNumber(s);
      if (time === undefined) {
        throw new Error(`Expected time to be defined in HH:MM:SS format, received: ${s}`);
      }
      ranges.push({ TimeEqual: [time] });
    });
  }
  if (args.time_not_equal) {
    args.time_not_equal.split(',').forEach((s) => {
      const time = userTimeToNumber(s);
      if (time === undefined) {
        throw new Error(`Expected time to be defined in HH:MM:SS format, received: ${s}`);
      }
      ranges.push({ TimeNotEqual: [time] });
    });
  }
  const validation: ValidationUpdate = {
    id: null,
    selection: getSelectionFromString(args.selection, sheet.id),
    rule: {
      DateTime: {
        ignore_blank: args.ignore_blank ?? true,
        require_date: args.require_date ?? false,
        require_time: args.require_time ?? false,
        prohibit_date: args.prohibit_date ?? false,
        prohibit_time: args.prohibit_time ?? false,
        ranges,
      },
    },
    message: {
      show: args.show_message ?? (isNotUndefinedOrNull(args.message_title) || isNotUndefinedOrNull(args.message_text)),
      title: args.message_title ?? '',
      message: args.message_text ?? '',
    },
    error: {
      show: args.show_error ?? true,
      style: args.error_style ?? 'Stop',
      title: args.error_title ?? '',
      message: args.error_message ?? '',
    },
  };
  await quadraticCore.updateValidation(validation, true);
  return `Date/time validation successfully added to ${args.selection}`;
};

const removeValidationsToolCall = async (args: AIToolsArgs[AITool.RemoveValidations]) => {
  const sheet = getSheetFromSheetName(args.sheet_name);
  await quadraticCore.removeValidationSelection(sheet.id, args.selection, true);
  return `Validation successfully removed from ${args.selection}`;
};

// Action handlers type

type ValidationToolActions = {
  [K in
    | AITool.GetValidations
    | AITool.AddMessage
    | AITool.AddLogicalValidation
    | AITool.AddListValidation
    | AITool.AddTextValidation
    | AITool.AddNumberValidation
    | AITool.AddDateTimeValidation
    | AITool.RemoveValidations]: (args: z.infer<(typeof AIToolsArgsSchema)[K]>) => Promise<ToolResultContent>;
};

// Exported action handlers

export const validationToolsActions: ValidationToolActions = {
  [AITool.GetValidations]: async (args) => {
    try {
      const text = getValidationsToolCall(args.sheet_name);
      return [createTextContent(text)];
    } catch (e) {
      return [createTextContent(`Error executing get validations tool: ${e}`)];
    }
  },
  [AITool.AddMessage]: async (args) => {
    try {
      updateAICursorForSelection(args.selection, args.sheet_name);
      const text = await addMessageToolCall(args);
      return [createTextContent(text)];
    } catch (e) {
      return [createTextContent(`Error executing add message tool: ${e}`)];
    }
  },
  [AITool.AddLogicalValidation]: async (args) => {
    try {
      updateAICursorForSelection(args.selection, args.sheet_name);
      const text = await addLogicalValidationToolCall(args);
      return [createTextContent(text)];
    } catch (e) {
      return [createTextContent(`Error executing add logical validation tool: ${e}`)];
    }
  },
  [AITool.AddListValidation]: async (args) => {
    try {
      updateAICursorForSelection(args.selection, args.sheet_name);
      const text = await addListValidationToolCall(args);
      return [createTextContent(text)];
    } catch (e) {
      return [createTextContent(`Error executing add list validation tool: ${e}`)];
    }
  },
  [AITool.AddTextValidation]: async (args) => {
    try {
      updateAICursorForSelection(args.selection, args.sheet_name);
      const text = await addTextValidationToolCall(args);
      return [createTextContent(text)];
    } catch (e) {
      return [createTextContent(`Error executing add text validation tool: ${e}`)];
    }
  },
  [AITool.AddNumberValidation]: async (args) => {
    try {
      updateAICursorForSelection(args.selection, args.sheet_name);
      const text = await addNumberValidationToolCall(args);
      return [createTextContent(text)];
    } catch (e) {
      return [createTextContent(`Error executing add number validation tool: ${e}`)];
    }
  },
  [AITool.AddDateTimeValidation]: async (args) => {
    try {
      updateAICursorForSelection(args.selection, args.sheet_name);
      const text = await addDateTimeValidationToolCall(args);
      return [createTextContent(text)];
    } catch (e) {
      return [createTextContent(`Error executing add date time validation tool: ${e}`)];
    }
  },
  [AITool.RemoveValidations]: async (args) => {
    try {
      updateAICursorForSelection(args.selection, args.sheet_name);
      const text = await removeValidationsToolCall(args);
      return [createTextContent(text)];
    } catch (e) {
      return [createTextContent(`Error executing remove validations tool: ${e}`)];
    }
  },
} as const;
