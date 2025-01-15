import { resizeColumnAction } from '@/app/actions';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { CommandGroup, CommandPaletteListItem } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';

const columnRowCommandGroup: CommandGroup = {
  heading: 'Column',
  commands: [
    {
      label: resizeColumnAction.label,
      isAvailable: resizeColumnAction.isAvailable,
      Component: (props) => {
        return (
          <CommandPaletteListItem
            {...props}
            action={() => pixiApp.pointer.pointerHeading.autoResizeColumn(sheets.sheet.cursor.position.x)}
          />
        );
      },
    },
  ],
};

export default columnRowCommandGroup;
