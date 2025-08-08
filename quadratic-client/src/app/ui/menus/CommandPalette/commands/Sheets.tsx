import { isAvailableBecauseCanEditFile } from '@/app/actions';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { focusGrid } from '@/app/helpers/focusGrid';
import type { CommandGroup } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { CommandPaletteListItem } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { SheetIcon } from '@/shared/components/Icons';
import { useEffect, useMemo, useState } from 'react';

const ListItems = () => {
  const [currentSheet, setCurrentSheet] = useState(sheets.current);

  const items = useMemo(() => {
    const items: CommandGroup = {
      heading: 'Sheets',
      commands: [
        {
          label: 'Create',
          keywords: ['create sheets', 'new sheets'],
          isAvailable: isAvailableBecauseCanEditFile,
          Component: (props) => {
            return (
              <CommandPaletteListItem
                {...props}
                action={() => quadraticCore.addSheet(undefined, undefined, false)}
                icon={<SheetIcon />}
              />
            );
          },
        },
        {
          label: 'Duplicate',
          isAvailable: isAvailableBecauseCanEditFile,
          Component: (props) => {
            return (
              <CommandPaletteListItem
                {...props}
                action={() => quadraticCore.duplicateSheet(currentSheet, undefined, false)}
                icon={<SheetIcon />}
              />
            );
          },
        },
        {
          label: 'Delete',
          isAvailable: isAvailableBecauseCanEditFile,
          Component: (props) => {
            return (
              <CommandPaletteListItem
                {...props}
                action={() => {
                  quadraticCore.deleteSheet(currentSheet, false);
                  setTimeout(focusGrid);
                }}
                icon={<SheetIcon />}
              />
            );
          },
        },
        ...sheets.map(
          (sheet) =>
            ({
              label: `Go to “${sheet.name}”`,
              keywords: [`Switch to “${sheet.name}”`],
              isAvailable: () => currentSheet !== sheet.id,
              Component: (props) => {
                return (
                  <CommandPaletteListItem
                    {...props}
                    icon={<SheetIcon style={{ color: sheet.color ? sheet.color : 'currentColor' }} />}
                    action={() => (sheets.current = sheet.id)}
                  />
                );
              },
            }) as CommandGroup['commands'][0]
        ),
      ],
    };

    return items;
  }, [currentSheet]);

  useEffect(() => {
    const handleChangeSheet = (sheetId: string) => setCurrentSheet(sheetId);
    events.on('changeSheet', handleChangeSheet);
    return () => {
      events.off('changeSheet', handleChangeSheet);
    };
  }, []);

  return items;
};

export default ListItems;
