import { useMemo } from 'react';
import { CommandPaletteListItem } from '../CommandPaletteListItem';
import { SheetController } from '../../../../grid/controller/sheetController';

export const useSheetListItems = (sheetController: SheetController) => {
  return useMemo(() => {
    return sheetController.getSheetListItems().map((item) => ({
      label: `Change to sheet: ${item.name}`,
      Component: (props: any) => {
        return (
          <CommandPaletteListItem
            {...props}
            action={() => {
              sheetController.current = item.id;
            }}
          />
        );
      },
    }));
  }, [sheetController]);
};
