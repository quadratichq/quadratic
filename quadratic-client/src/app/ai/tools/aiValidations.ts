import { bigIntReplacer } from '@/app/bigint';
import { sheets } from '@/app/grid/controller/Sheets';
import type { Sheet } from '@/app/grid/sheet/Sheet';
import type { A1Selection, Validation } from '@/app/quadratic-core-types';
import { addToSelection } from '@/app/quadratic-core/quadratic_core';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import type { AITool, AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';

import { v4 } from 'uuid';

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
      ` - ${validation.rule.List.ignore_blank} ?'allows' : 'does not allow'} blank messages\n` +
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

export const getValidationsToolCall = (sheetName: string | undefined): string => {
  const sheet = sheetName ? (sheets.getSheetByName(sheetName) ?? sheets.sheet) : sheets.sheet;
  if (!sheet) {
    throw new Error('Sheet not found');
  }
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

const getSelectionFromString = (selection: string, sheetId: string): A1Selection => {
  try {
    const a1SelectionJson = sheets.stringToSelection(selection, sheetId).save();
    return JSON.parse(a1SelectionJson, bigIntReplacer) as A1Selection;
  } catch (e) {
    throw new Error(`Invalid selection: ${selection}`);
  }
};

const getSheetFromSheetName = (sheetName: string | undefined): Sheet => {
  return sheetName ? (sheets.getSheetByName(sheetName) ?? sheets.sheet) : sheets.sheet;
};

const appendSelection = (selection: A1Selection, a1: string): A1Selection => {
  let newSelection: A1Selection;
  try {
    newSelection = JSON.parse(
      addToSelection(JSON.stringify(selection), a1, sheets.jsA1Context),
      bigIntReplacer
    ) as A1Selection;
  } catch (e) {
    throw new Error(`Invalid selection: ${selection}`);
  }
  return newSelection;
};

export const addMessageToolCall = async (o: AIToolsArgs[AITool.AddMessage]): Promise<string> => {
  const sheet = getSheetFromSheetName(o.sheet_name);
  const validations = sheet.validations;
  const existingValidation = validations.find((validation) => {
    return (
      validation.rule === 'None' &&
      validation.message.title === o.message_title &&
      validation.message.message === o.message_text &&
      validation.message.show === true
    );
  });
  if (existingValidation) {
    await quadraticCore.updateValidation({
      ...existingValidation,
      selection: appendSelection(existingValidation.selection, o.selection),
    });
  } else {
    const validation: Validation = {
      id: v4(),
      selection: getSelectionFromString(o.selection, sheet.id),
      rule: 'None',
      message: {
        show: true,
        title: o.message_title ?? '',
        message: o.message_text ?? '',
      },
      // we shouldn't have errors in a validation that is only a message
      error: {
        show: false,
        style: 'Stop',
        title: '',
        message: '',
      },
    };
    await quadraticCore.updateValidation(validation);
  }
  return `Message successfully added to ${o.selection}`;
};

export const addLogicalValidationToolCall = async (o: AIToolsArgs[AITool.AddLogicalValidation]) => {
  const sheet = getSheetFromSheetName(o.sheet_name);
  const validations = sheet.validations;
  const existingValidation = validations.find((validation) => {
    return (
      validation.rule !== 'None' &&
      'Logical' in validation.rule &&
      validation.rule.Logical.show_checkbox === o.show_checkbox &&
      validation.rule.Logical.ignore_blank === o.ignore_blank
    );
  });
  if (existingValidation) {
    await quadraticCore.updateValidation({
      ...existingValidation,
      selection: appendSelection(existingValidation.selection, o.selection),
    });
  } else {
    const validation: Validation = {
      id: v4(),
      selection: getSelectionFromString(o.selection, sheet.id),
      rule: {
        Logical: {
          show_checkbox: o.show_checkbox ?? true,
          ignore_blank: o.ignore_blank ?? false,
        },
      },
      message: {
        show: true,
        title: o.message_title ?? '',
        message: o.message_text ?? '',
      },
      error: {
        show: o.show_error ?? true,
        style: o.error_style ?? 'Stop',
        title: o.error_title ?? '',
        message: o.error_message ?? '',
      },
    };
    await quadraticCore.updateValidation(validation);
  }
};

export const removeValidationsToolCall = async (o: AIToolsArgs[AITool.RemoveValidations]) => {
  const sheet = getSheetFromSheetName(o.sheet_name);
  await quadraticCore.removeValidationSelection(sheet.id, o.selection);
  return `Validation successfully removed from ${o.selection}`;
};
