import { sheets } from '@/app/grid/controller/Sheets';

export const fileHasData = () => sheets.sheets.filter((sheet) => sheet.bounds.type === 'nonEmpty').length > 0;
