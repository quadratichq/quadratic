import { sheets } from '@/app/grid/controller/Sheets';

export const fileHasData = () => sheets.sheets.some((sheet) => sheet.bounds.type === 'nonEmpty');
