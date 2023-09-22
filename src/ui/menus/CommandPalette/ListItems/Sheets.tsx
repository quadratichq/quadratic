import { useEffect, useMemo, useState } from 'react';
import { grid } from '../../../../grid/controller/Grid';
import { sheets } from '../../../../grid/controller/Sheets';
import { focusGrid } from '../../../../helpers/focusGrid';
import { CommandPaletteListItem } from '../CommandPaletteListItem';
import { Commands } from '../getCommandPaletteListItems';

const ListItems = () => {
  // used to trigger changes in sheets
  const [trigger, setTrigger] = useState(0);

  const items = useMemo(() => {
    const items: Commands[] = [
      {
        label: 'Sheet: Create',
        Component: (props: any) => {
          return <CommandPaletteListItem {...props} action={() => sheets.createNew()} />;
        },
      },
      {
        label: 'Sheet: Delete',
        Component: (props: any) => {
          return (
            <CommandPaletteListItem
              {...props}
              action={() => {
                if (window.confirm(`Are you sure you want to delete ${sheets.sheet.name}?`)) {
                  sheets.deleteSheet(sheets.sheet.id);
                }
                setTimeout(focusGrid);
              }}
            />
          );
        },
      },
      {
        label: 'Sheet: Duplicate',
        Component: (props: any) => {
          return <CommandPaletteListItem {...props} action={() => grid.duplicateSheet(sheets.sheet.id)} />;
        },
      },
    ];
    sheets.forEach((sheet) => {
      items.push({
        label: `Sheet: Switch to “${sheet.name}”`,
        isAvailable: () => sheets.current !== sheet.id,
        Component: (props: any) => {
          return (
            <CommandPaletteListItem
              {...props}
              icon={
                sheet.color ? (
                  <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center' }}>
                    <div
                      style={{
                        // FWIW: these styles match the syltes of the 3rd-party color picker swatches
                        width: '15px',
                        height: '15px',
                        backgroundColor: sheet.color,
                        borderRadius: '2px',
                      }}
                    />
                  </div>
                ) : undefined
              }
              action={() => (sheets.current = sheet.id)}
            />
          );
        },
      });
    });
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
