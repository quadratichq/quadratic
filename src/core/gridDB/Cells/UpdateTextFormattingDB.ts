import { qdb } from '../db';
import { GetSelection } from '../../../ui/menus/TopBar/SubMenus/useGetSelection';

export const updateTextFormattingDB = async (
  user_selection: GetSelection,
  number_formatting_pattern?: string,
  date_formatting_pattern?: string
): Promise<void> => {
  let cells = qdb.cells.getCells(
    user_selection.start.x,
    user_selection.start.y,
    user_selection.end.x,
    user_selection.end.y
  );
  cells.forEach((cell) => {
    cell.number_formatting_pattern = number_formatting_pattern;
    cell.date_formatting_pattern = date_formatting_pattern;
  });
};

export const clearTextFormattingDB = async (user_selection: GetSelection): Promise<void> => {
  let cells = qdb.cells.getCells(
    user_selection.start.x,
    user_selection.start.y,
    user_selection.end.x,
    user_selection.end.y
  );
  cells.forEach((cell) => {
    cell.number_formatting_pattern = undefined;
    cell.date_formatting_pattern = undefined;
  });
};
