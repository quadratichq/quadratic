import { bigIntReplacer } from '@/app/bigint';
import { sheets } from '@/app/grid/controller/Sheets';
import type { Sheet } from '@/app/grid/sheet/Sheet';
import type { A1Selection, Validation } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

import { v4 } from 'uuid';

const convertValidationToText = (validation: Validation) => {
  // if (validation.rule === 'None') {
  // }
  // if ('Logical' in validation.rule) {
  //   return `Logical validation: ${validation.message} ${validation.error_message}`;
  // }
  // if ('List' in validation.rule) {
  //   return `List validation: ${validation.message} ${validation.error_message}`;
  // }
  // if ('Text' in validation.rule) {
  //   return `Text validation: ${validation.message} ${validation.error_message}`;
  // }
  // if ('Number' in validation.rule) {
  //   return `Number validation: ${validation.message} ${validation.error_message}`;
  // }
  // if ('DateTime' in validation.rule) {
  //   return `Date time validation: ${validation.message} ${validation.error_message}`;
  // }
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
    response += convertValidationToText(validation);
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

export const addMessageToolCall = (
  sheetName: string | undefined,
  selection: string,
  messageTitle: string,
  messageText: string
): string => {
  const sheet = getSheetFromSheetName(sheetName);
  const validations = sheet.validations;
  const existingValidation = validations.find((validation) => {
    return (
      validation.rule === 'None' &&
      validation.message.title === 'messageTitle' &&
      validation.message.message === messageText &&
      validation.message.show === true
    );
  });
  if (existingValidation) {

  } else {
    const validation: Validation = {
      id: v4(),
      selection: getSelectionFromString(selection, sheet.id),
      rule: 'None',
      message: {
        show: true,
        title: messageTitle,
        message: messageText,
      },
      error: {
        show: false,
        style: 'Stop',
        title: '',
        message: '',
      }
    }
    await quadraticCore.updateValidation(validation);
  }
  return `Message successfully added to ${selection}`.
};
