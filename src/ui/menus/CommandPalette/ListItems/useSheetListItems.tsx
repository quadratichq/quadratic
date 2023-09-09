import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import { useEffect, useState } from 'react';
import { sheetController } from '../../../../grid/controller/SheetController';
import { CommandPaletteListItem } from '../CommandPaletteListItem';
import { Commands } from '../getCommandPaletteListItems';

export const useSheetListItems = (): Commands[] => {
  const [commands, setCommands] = useState<Commands[]>([]);

  const updateCommands = () => {
    setCommands(
      sheetController.sheets.getSheetListItems().map((item) => ({
        label: `Sheet: ${item.name}`,
        Component: (props: any) => (
          <CommandPaletteListItem
            {...props}
            icon={<ArticleOutlinedIcon />}
            action={() => (sheetController.sheets.current = item.id)}
          />
        ),
      }))
    );
  };

  useEffect(() => {
    window.addEventListener('change-sheet', updateCommands);
    return () => window.removeEventListener('change-sheet', updateCommands);
  }, []);

  updateCommands();

  return commands;
};
