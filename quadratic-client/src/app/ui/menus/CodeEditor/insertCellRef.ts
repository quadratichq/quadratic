import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { CodeCellLanguage } from '@/app/quadratic-core-types';

export const insertCellRef = (selectedCellSheet: string, mode?: CodeCellLanguage, relative?: boolean) => {
  const language = getLanguage(mode);
  const a1Notation = sheets.getA1String(selectedCellSheet);
  let ref = '';

  if (relative) {
    throw new Error('relative not handled in insertCellRef');
  }

  if (language === 'Formula') {
    ref = a1Notation;
  } else if (language === 'Python' || language === 'Javascript') {
    ref = `q.cells('${a1Notation}')`;
  } else if (language === 'Connection') {
    ref = `{{${a1Notation}}}`;
  }

  events.emit('insertCodeEditorText', ref);
};
