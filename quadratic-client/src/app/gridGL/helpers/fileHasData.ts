import { sheets } from '@/app/grid/controller/Sheets';

export const fileHasData = () => sheets.sheets.some((sheet) => sheet.boundsWithoutFormatting.type === 'nonEmpty');
