import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import { useMemo } from 'react';
import { SheetController } from '../../../../grid/controller/SheetController';
import { CommandPaletteListItem } from '../CommandPaletteListItem';

export const useSheetListItems = (sheetController: SheetController) => {
  return useMemo(() => {
    return sheetController.sheets.getSheetListItems().map((item) => ({
      label: `Sheet: ${item.name}`,
      Component: (props: any) => (
        <CommandPaletteListItem
          {...props}
          icon={<ArticleOutlinedIcon />}
          action={() => (sheetController.sheets.current = item.id)}
        />
      ),
    }));
  }, [sheetController]);
};
