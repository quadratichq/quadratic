import { sheets } from '@/app/grid/controller/Sheets';
import { rectToA1 } from '@/app/quadratic-core/quadratic_core';

export const sheetsContext = (currentSheetName: string) => {
  return `
There are ${sheets.sheets.length} sheets in the current file.\n

The user started this chat on the sheet named '${currentSheetName}'.\n
${currentSheetName !== sheets.sheet.name ? `Note that the user is currently looking at the sheet named '${sheets.sheet.name}'.\n` : ''}

<Instructions>\n
  AI actions SHOULD be performed on the sheet named ${currentSheetName} unless the user or AI reasoning specifies otherwise.\n
</Instructions>\n

The remaining sheets in the file are named: ${sheets.sheets
    .filter((sheet) => sheet.name !== currentSheetName)
    .map((sheet) => sheet.name)
    .reduce((acc, name, i, arr) => {
      if (i === arr.length - 1) return `${acc}, and ${name}`;
      return acc ? `${acc}, ${name}` : name;
    }, '')}.\n`;
};

export const sheetContext = (sheetName: string) => {
  const sheet = sheets.getSheetByName(sheetName);
  if (!sheet) return '';

  const sheetBounds = sheet.boundsWithoutFormatting;
  const formatBounds = sheet.formatBounds;

  return `
The sheet named '${sheet.name}' has the following information:\n
${
  sheetBounds.type === 'nonEmpty'
    ? `Data is contained within ${rectToA1(sheetBounds)}. Note: there may be empty cells within this range.\n`
    : 'There is no data in this sheet.\n'
}\n
${
  formatBounds.type === 'nonEmpty'
    ? `Formatting (like bold, currency, fill, etc.) is contained within ${rectToA1(formatBounds)}. Note: there may be non-formatted cells within this range\n`
    : 'There is no formatting in this sheet.\n'
}\n
<Instructions>\n
  If you need additional information about the sheet named '${sheet.name}', use the get_cell_data function to retrieve information about the sheet that is not contained within the context.\n
  When changing the sheet's data, you MUST ensure you have sufficient data about that sheet before taking any action.\n
  If necessary, you can also check the current formatting for a sheet by using the get_text_formats function.\n
  Note, there is no data or formatting outside the bounds provided above.\n
</Instructions>\n
`;
};
