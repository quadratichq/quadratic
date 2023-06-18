import { useMemo } from 'react';
import { CommandPaletteListItem } from '../CommandPaletteListItem';
import { SheetController } from '../../../../grid/controller/sheetController';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';

export const useSheetListItems = (sheetController: SheetController) => {
  return useMemo(() => {
    return sheetController.getSheetListItems().map((item) => ({
      label: `Sheet: ${item.name}`,
      Component: (props: any) => (
        <CommandPaletteListItem
          {...props}
          icon={<ArticleOutlinedIcon />}
          action={() => (sheetController.current = item.id)}
        />
      ),
    }));
  }, [sheetController]);
};
