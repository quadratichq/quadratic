import { ViewGridIcon } from '@radix-ui/react-icons';
import { useEffect, useMemo, useState } from 'react';
import { isEditorOrAbove } from '../../../../actions';
import { grid } from '../../../../grid/controller/Grid';
import { sheets } from '../../../../grid/controller/Sheets';
import { focusGrid } from '../../../../helpers/focusGrid';
import { CommandPaletteListItem } from '../CommandPaletteListItem';

const ListItems = () => {
  // used to trigger changes in sheets
  const [trigger, setTrigger] = useState(0);

  const items = useMemo(() => {
    const items /*: Commands[]*/ = [
      {
        isAvailable: isEditorOrAbove,
        Component: () => {
          return (
            <CommandPaletteListItem
              icon={<ViewGridIcon />}
              label="Create"
              action={() => sheets.createNew()}
            ></CommandPaletteListItem>
          );
        },
      },
      {
        isAvailable: isEditorOrAbove,
        Component: (props: any) => {
          return (
            <CommandPaletteListItem
              label="Delete"
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
        isAvailable: isEditorOrAbove,
        Component: (props: any) => {
          return <CommandPaletteListItem action={() => grid.duplicateSheet(sheets.sheet.id)} label="Duplicate" />;
        },
      },
    ];
    sheets.forEach((sheet) => {
      items.push({
        isAvailable: () => sheets.current !== sheet.id,
        Component: (props: any) => {
          return (
            <CommandPaletteListItem
              label={`Switch to “${sheet.name}”`}
              icon={
                sheet.color ? (
                  <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center' }}>
                    <div
                      style={{
                        width: '24px',
                        height: '3px',
                        backgroundColor: sheet.color,
                        borderRadius: '1px',
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
