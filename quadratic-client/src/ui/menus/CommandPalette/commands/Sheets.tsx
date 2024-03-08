import { SheetDeleteIcon, SheetDuplicateIcon, SheetIcon, SheetSwitchIcon } from '@/ui/icons/radix';
import { useEffect, useMemo, useState } from 'react';
import { hasPermissionToEditFile } from '../../../../actions';
import { grid } from '../../../../grid/controller/Grid';
import { sheets } from '../../../../grid/controller/Sheets';
import { focusGrid } from '../../../../helpers/focusGrid';
import { CommandGroup, CommandPaletteListItem } from '../CommandPaletteListItem';

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
          isAvailable: hasPermissionToEditFile,
          Component: (props) => {
            return <CommandPaletteListItem {...props} action={() => sheets.createNew()} icon={<SheetIcon />} />;
          },
        },
        {
          label: 'Duplicate',
          isAvailable: hasPermissionToEditFile,
          Component: (props) => {
            return (
              <CommandPaletteListItem
                {...props}
                action={() => grid.duplicateSheet(sheets.sheet.id)}
                icon={<SheetDuplicateIcon />}
              />
            );
          },
        },
        {
          label: 'Delete',
          isAvailable: hasPermissionToEditFile,
          Component: (props) => {
            return (
              <CommandPaletteListItem
                {...props}
                action={() => {
                  if (window.confirm(`Are you sure you want to delete ${sheets.sheet.name}?`)) {
                    sheets.deleteSheet(sheets.sheet.id);
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
                    icon={<SheetSwitchIcon color={sheet.color ? sheet.color : 'currentColor'} />}
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
    window.addEventListener('change-sheet', updateTrigger);
    return window.removeEventListener('change-sheet', updateTrigger);
  }, []);

  return items;
};

export default ListItems;
