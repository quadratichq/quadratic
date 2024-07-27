import { useEffect, useMemo, useState } from 'react';

import { isAvailableBecauseCanEditFile } from '@/app/actions';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { focusGrid } from '@/app/helpers/focusGrid';
import { SheetDeleteIcon, SheetDuplicateIcon, SheetGoToIcon, SheetIcon } from '@/app/ui/icons';
import { CommandPaletteListItem } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import type { CommandGroup } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

const ListItems = () => {
  // used to trigger changes in sheets
  const [trigger, setTrigger] = useState(0);

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
                action={() => quadraticCore.addSheet(sheets.getCursorPosition())}
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
                action={() => quadraticCore.duplicateSheet(sheets.sheet.id, sheets.getCursorPosition())}
                icon={<SheetDuplicateIcon />}
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
                  if (window.confirm(`Are you sure you want to delete ${sheets.sheet.name}?`)) {
                    quadraticCore.deleteSheet(sheets.sheet.id, sheets.getCursorPosition());
                  }
                  setTimeout(focusGrid);
                }}
                icon={<SheetDeleteIcon />}
              />
            );
          },
        },
        ...sheets.map(
          (sheet) =>
            ({
              label: `Go to “${sheet.name}”`,
              keywords: [`Switch to “${sheet.name}”`],
              isAvailable: () => sheets.current !== sheet.id,
              Component: (props) => {
                return (
                  <CommandPaletteListItem
                    {...props}
                    icon={<SheetGoToIcon style={{ color: sheet.color ? sheet.color : 'currentColor' }} />}
                    action={() => (sheets.current = sheet.id)}
                  />
                );
              },
            } as CommandGroup['commands'][0])
        ),
      ],
    };

    return items;

    // trigger is only used to trigger changes (and will be shown as a warning)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  useEffect(() => {
    const updateTrigger = () => setTrigger((trigger) => trigger + 1);
    events.on('changeSheet', updateTrigger);
    return () => {
      events.off('changeSheet', updateTrigger);
    };
  }, []);

  return items;
};

export default ListItems;
