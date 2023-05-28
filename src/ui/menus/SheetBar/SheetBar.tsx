import { Box } from '@mui/system';
import { SheetController } from '../../../grid/controller/sheetController';
import { colors } from '../../../theme/colors';
import { Tab, Tabs } from '@mui/material';
import { KeyboardEvent, PointerEvent, useCallback, useRef, useState } from 'react';
import { useLocalFiles } from '../../contexts/LocalFiles';
import { focusGrid } from '../../../helpers/focusGrid';

interface Props {
  sheetController: SheetController;
}

export const SheetBar = (props: Props): JSX.Element => {
  const { sheetController } = props;

  // rename sheet
  const localFiles = useLocalFiles();
  const [isRenaming, setIsRenaming] = useState<number | false>(false);
  const onRenameSheet = useCallback(
    (name?: string) => {
      if (name) {
        sheetController.sheet.rename(name);
        localFiles.save();
      }
      setIsRenaming(false);
    },
    [localFiles, sheetController.sheet]
  );

  // activate sheet
  const [activeSheet, setActiveSheet] = useState(sheetController.current);
  const changeSheet = useCallback(
    (_, value: number | 'create') => {
      if (value === 'create') {
        sheetController.addSheet();
        setActiveSheet(sheetController.current);
      } else {
        sheetController.current = value;
        setActiveSheet(sheetController.current);
      }
      focusGrid();
    },
    [sheetController]
  );

  // handle drag tabs
  const down = useRef<
    | { tab: HTMLElement; x: number; order: number; original: number; offset: number; id: string; actualOrder: number }
    | undefined
  >();
  const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>, order: number) => {
    const tab = event.currentTarget.parentElement;
    if (tab) {
      const rect = tab.getBoundingClientRect();
      const id = tab.getAttribute('data-id');
      if (!id) {
        throw new Error('Expected sheet.id to be defined in SheetBar.handlePointerDown');
      }
      down.current = {
        tab,
        x: event.clientX,
        order,
        original: order,
        actualOrder: order,
        offset: event.clientX - rect.left,
        id,
      };
    }
  }, []);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (down.current) {
      // store current tabs (except the dragging tab)
      const tabs: { rect: DOMRect; order: number; element: HTMLDivElement }[] = [];
      const tab = down.current.tab;
      down.current.tab.parentElement?.childNodes.forEach((node) => {
        if (node !== tab) {
          const element = node as HTMLDivElement;
          let order = element.getAttribute('data-order');
          if (order) {
            tabs.push({ rect: element.getBoundingClientRect(), order: parseInt(order), element });
          }
        }
      });

      // search for an overlap from the current tabs to replace its order
      const overlap = tabs.find((tab) => event.clientX >= tab.rect.left && event.clientX <= tab.rect.right);
      if (overlap) {
        const newOrder = overlap.order + (down.current.order <= overlap.order ? 1 : 0);

        // reset down.x to the correct position for the newly ordered tabs
        // todo: this is not exactly correct
        if (newOrder > down.current.order) {
          down.current.x = down.current.offset + event.clientX;
        } else {
          down.current.x = down.current.offset + event.clientX - overlap.element.offsetWidth;
        }
        down.current.actualOrder = newOrder - 0.5;
        tab.style.order = newOrder.toString();
        down.current.order = newOrder;
        down.current.tab.style.transform = '';
      }

      // otherwise transform the button so it looks like its moving
      else {
        down.current.tab.style.transform = `translateX(${event.clientX - down.current.x}px)`;
      }
    }
  }, []);

  const handlePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (down.current) {
      if (down.current.order !== down.current.original) {
        sheetController.reorderSheet(down.current.id, down.current.actualOrder);
      }
      down.current.tab.style.transform = '';
      down.current = undefined;
    }
  }, []);

  return (
    <div
      onContextMenu={(event) => {
        // Disable right-click
        event.preventDefault();
      }}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderTop: `1px solid ${colors.mediumGray}`,
        color: colors.darkGray,
        bottom: 0,
        width: '100%',
        backdropFilter: 'blur(1px)',
        display: 'flex',
        justifyContent: 'space-between',
        paddingLeft: '1rem',
        paddingRight: '1rem',
        fontFamily: 'sans-serif',
        fontSize: '0.7rem',
        userSelect: 'none',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          height: '1.5rem',
        }}
      >
        <Tabs
          value={activeSheet}
          onChange={changeSheet}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="select sheet control"
          sx={{ height: '1.5rem', fontSize: '14px' }}
          component="div"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {sheetController.sheets.map((sheet, index) => (
            <Tab
              data-order={sheet.order}
              data-id={sheet.id}
              className="sheetBarTab"
              key={index}
              value={index}
              label={
                <div
                  onPointerDown={(e) => handlePointerDown(e, sheet.order)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  style={{
                    outline: 'none',
                  }}
                  onKeyUp={(e: KeyboardEvent<HTMLDivElement>) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                      onRenameSheet(e.currentTarget.innerText);
                      focusGrid();
                    } else if (e.key === 'Escape') {
                      onRenameSheet();
                      e.currentTarget.blur();
                    }
                  }}
                  contentEditable={isRenaming === index}
                  suppressContentEditableWarning={true}
                  tabIndex={1}
                  onFocus={(e) => {
                    const div = e.currentTarget;
                    const range = document.createRange();
                    range.selectNodeContents(div);
                    const selection = document.getSelection();
                    if (selection) {
                      selection.removeAllRanges();
                      selection.addRange(range);
                    }
                  }}
                >
                  {sheet.name}
                </div>
              }
              onDoubleClick={(e) => {
                setIsRenaming(index);
                e.stopPropagation();
              }}
              sx={{
                height: '1.5rem',
                padding: 0,
                textAlign: 'center',
                textTransform: 'none',
                marginRight: '1rem',
                outline: 'none',
                border: 'none',
                order: sheet.order,
              }}
            />
          ))}
          <Tab value={'create'} label="+" style={{ width: '1rem', order: sheetController.sheets.length }} />
        </Tabs>
      </Box>
    </div>
  );
};
