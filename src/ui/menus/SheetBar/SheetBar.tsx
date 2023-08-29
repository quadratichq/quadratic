import './SheetBar.css';

import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { MouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import { SheetController } from '../../../grid/controller/SheetController';
import { Sheet } from '../../../grid/sheet/Sheet';
import { focusGrid } from '../../../helpers/focusGrid';
import { SheetBarTab } from './SheetBarTab';
import { SheetBarTabContextMenu } from './SheetBarTabContextMenu';

interface Props {
  sheetController: SheetController;
}

const ARROW_SCROLL_AMOUNT = 10;
const HOVER_SCROLL_AMOUNT = 5;
const SCROLLING_INTERVAL = 17;
const ARROW_REPEAT_INTERVAL = 17;

export const SheetBar = (props: Props): JSX.Element => {
  const { sheetController } = props;

  // used to trigger state change (eg, when sheetController.sheets change)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, setTrigger] = useState(0);

  // activate sheet
  const [activeSheet, setActiveSheet] = useState(sheetController.current);

  useEffect(() => {
    const updateSheet = () => {
      setTrigger((trigger) => trigger + 1);
      setActiveSheet(sheetController.current);
    };
    window.addEventListener('change-sheet', updateSheet);
    return () => window.removeEventListener('change-sheet', updateSheet);
  }, [sheetController]);

  // handle disabling left arrow and right arrow
  const [sheets, setSheets] = useState<HTMLDivElement | undefined>();
  const [leftArrow, setLeftArrow] = useState<HTMLElement | undefined>();
  const [rightArrow, setRightArrow] = useState<HTMLElement | undefined>();
  const leftRef = useCallback(
    (node: HTMLButtonElement) => {
      setLeftArrow(node);
      if (!sheets || !node) return;
      const hide = sheets.scrollLeft === 0 || sheets.offsetWidth === sheets.scrollWidth;
      node.style.opacity = hide ? '0.25' : '1';
      node.style.cursor = hide ? 'auto' : 'pointer';
    },
    [sheets]
  );

  const rightRef = useCallback(
    (node: HTMLButtonElement) => {
      setRightArrow(node);
      if (!sheets || !node) return;
      const hide =
        sheets.offsetWidth === sheets.scrollWidth ||
        Math.round(sheets.scrollLeft) === Math.round(sheets.scrollWidth - sheets.offsetWidth);
      node.style.opacity = hide ? '0.25' : '1';
      node.style.cursor = hide ? 'auto' : 'pointer';
    },
    [sheets]
  );
  const sheetsRef = useCallback(
    (node: HTMLDivElement) => {
      setSheets(node);
      if (!node) return;
      node.addEventListener('scroll', () => {
        if (leftArrow) {
          const hide = node.scrollLeft === 0 || node.offsetWidth === node.scrollWidth;
          leftArrow.style.opacity = hide ? '0.25' : '1';
          leftArrow.style.cursor = hide ? 'auto' : 'pointer';
        }
        if (rightArrow) {
          const hide =
            node.offsetWidth === node.scrollWidth ||
            Math.round(node.scrollLeft) === Math.round(node.scrollWidth - node.offsetWidth);
          rightArrow.style.opacity = hide ? '0.25' : '1';
          rightArrow.style.cursor = hide ? 'auto' : 'pointer';
        }
      });
    },
    [leftArrow, rightArrow]
  );

  // return tab to original spot when pressing Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && down.current) {
        if (scrolling.current) {
          window.clearInterval(scrolling.current);
          scrolling.current = undefined;
        }
        const tab = down.current.tab;
        tab.style.boxShadow = '';
        tab.style.zIndex = '';
        tab.style.transform = '';
        tab.style.order = down.current.originalOrder.toString();
        tab.scrollIntoView();
        down.current = undefined;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // ensure active tab is visible when changed
  useEffect(() => {
    if (sheets) {
      const children = [...sheets.children];
      const tab = children.find((child) => child.getAttribute('data-id') === activeSheet);
      if (tab) {
        tab.scrollIntoView();
      }
    }
  }, [activeSheet, sheets]);

  // handle drag tabs
  const down = useRef<
    | {
        tab: HTMLElement;
        offset: number;
        id: string;

        // as fractional-index
        originalOrder: string;

        // as index * 2
        originalOrderIndex: number;
        actualOrderIndex: number;

        // sheet id of overlap
        overlap?: string;
        scrollWidth: number;
      }
    | undefined
  >();
  const scrolling = useRef<undefined | number>();

  // finds the index * 2 for a new order string
  const getOrderIndex = useCallback(
    (order: string): number => {
      const orders = sheetController.sheets.map((sheet) => sheet.order);
      if (orders.length === 0) {
        return 0;
      }
      for (let i = 0; i < orders.length; i++) {
        if (order < orders[i]) {
          return i * 2;
        }
      }
      return orders.length * 2;
    },
    [sheetController.sheets]
  );

  const handlePointerDown = useCallback(
    (options: { event: React.PointerEvent<HTMLDivElement>; sheet: Sheet }) => {
      if (!sheets) return;
      const { event, sheet } = options;
      setActiveSheet((prevState: string) => {
        if (prevState !== sheet.id) {
          sheetController.current = sheet.id;
          setActiveSheet(sheet.id);
          return sheet.id;
        }
        return prevState;
      });

      const tab = event.currentTarget;
      if (tab) {
        const rect = tab.getBoundingClientRect();
        const originalOrderIndex = getOrderIndex(sheet.order);
        down.current = {
          tab,
          offset: event.clientX - rect.left,
          id: sheet.id,
          scrollWidth: sheets.scrollWidth,
          originalOrder: sheet.order,
          originalOrderIndex,
          actualOrderIndex: originalOrderIndex,
        };
        setTimeout(() => {
          if (down.current) {
            tab.style.boxShadow = '0.25rem -0.25rem 0.5rem rgba(0,0,0,0.25)';
          }
        }, 500);
        tab.style.zIndex = '2';
      }
      focusGrid();
      event.preventDefault();
    },
    [getOrderIndex, sheetController, sheets]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const tab = down.current?.tab;
      if (!tab || !sheets) return;

      // clears scrolling interval
      const clearScrollingInterval = () => {
        if (scrolling.current !== undefined) {
          window.clearInterval(scrolling.current);
          scrolling.current = undefined;
        }
      };

      // positions dragging div
      const positionTab = () => {
        if (!down.current) return;
        const left = event.clientX - tab.offsetLeft + sheets.scrollLeft - down.current.offset;
        tab.style.transform = `translateX(${left}px)`;
      };

      // handles when dragging tab overlaps another tab
      const checkPosition = (mouseX: number) => {
        if (!down.current) return;

        // store current tabs (except the dragging tab)
        const tabs: { rect: DOMRect; order: string; element: HTMLDivElement }[] = [];

        down.current.tab.parentElement?.childNodes.forEach((node) => {
          const element = node as HTMLDivElement;
          if (element !== tab) {
            let order = element.getAttribute('data-order');
            if (order) {
              tabs.push({ rect: element.getBoundingClientRect(), order, element });
            }
          }
        });

        // search for an overlap from the current tabs to replace its order
        const overlap = tabs.find((tab) => mouseX >= tab.rect.left && mouseX <= tab.rect.right);
        if (overlap) {
          if (down.current.overlap !== overlap.order) {
            // ensure we only use the overlapping tab one time
            down.current.overlap = overlap.order;

            const overlapIndex = getOrderIndex(overlap.order);
            // moving left
            if (down.current.actualOrderIndex > overlapIndex) {
              // place floating tab to the left of the overlapped tab
              down.current.actualOrderIndex = overlapIndex - 1;
              tab.style.order = down.current.actualOrderIndex.toString();
            }

            // moving right
            else {
              // place floating tab to the right of the overlapped tab
              down.current.actualOrderIndex = overlapIndex + 1;
              tab.style.order = down.current.actualOrderIndex.toString();
            }
          }
        } else {
          down.current.overlap = undefined;
        }
        positionTab();
      };

      if (down.current) {
        event.stopPropagation();
        event.preventDefault();

        checkPosition(event.clientX);

        // when dragging, scroll the sheets div if necessary
        if (sheets.offsetWidth !== down.current.scrollWidth) {
          // scroll to the right if necessary
          if (
            event.clientX > sheets.offsetLeft + sheets.offsetWidth &&
            sheets.scrollLeft < down.current.scrollWidth - sheets.offsetWidth
          ) {
            if (scrolling.current) return;
            clearScrollingInterval();
            scrolling.current = window.setInterval(() => {
              if (!down.current) return;
              if (sheets.scrollLeft < down.current.scrollWidth - sheets.offsetWidth + tab.offsetWidth) {
                sheets.scrollLeft += HOVER_SCROLL_AMOUNT;
              } else {
                sheets.scrollLeft = down.current.scrollWidth - sheets.offsetWidth;
                clearScrollingInterval();
              }
              checkPosition(event.clientX);
              positionTab();
            }, SCROLLING_INTERVAL);
          }

          // scroll to the left
          else if (event.clientX < sheets.offsetLeft && sheets.scrollLeft !== 0) {
            clearScrollingInterval();
            scrolling.current = window.setInterval(() => {
              if (!down.current) return;
              if (sheets.scrollLeft !== 0) {
                sheets.scrollLeft -= HOVER_SCROLL_AMOUNT;
              } else {
                sheets.scrollLeft = 0;
                clearScrollingInterval();
              }
              checkPosition(event.clientX);
              positionTab();
            }, SCROLLING_INTERVAL);
          } else {
            clearScrollingInterval();
          }
        }
      }
    },
    [getOrderIndex, sheets]
  );

  const scrollInterval = useRef<number | undefined>();
  const handleArrowDown = useCallback(
    (direction: number) => {
      if (scrollInterval.current) {
        window.clearInterval(scrollInterval.current);
      }
      if (sheets) {
        sheets.scrollLeft += ARROW_SCROLL_AMOUNT * direction;
        scrollInterval.current = window.setInterval(
          () => (sheets.scrollLeft += ARROW_SCROLL_AMOUNT * direction),
          ARROW_REPEAT_INTERVAL
        );
      }
    },
    [sheets]
  );
  const handleArrowUp = useCallback(() => {
    if (scrollInterval.current) {
      window.clearInterval(scrollInterval.current);
      scrollInterval.current = undefined;
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    if (down.current) {
      if (scrolling.current) {
        window.clearInterval(scrolling.current);
        scrolling.current = undefined;
      }
      const tab = down.current.tab;
      tab.style.boxShadow = '';
      tab.style.zIndex = '';
      tab.style.transform = '';

      if (down.current.actualOrderIndex !== down.current.originalOrderIndex) {
        const sheet = sheetController.sheets.getById(down.current.id);
        if (!sheet) {
          throw new Error('Expect sheet to be defined in SheetBar.pointerUp');
        }
        const tabs: { order: number; id: string }[] = [];

        down.current.tab.parentElement?.childNodes.forEach((node) => {
          const element = node as HTMLDivElement;
          if (element !== tab) {
            let order = parseInt(element.style.order);
            let id = element.getAttribute('data-id');
            if (!id || !order) throw new Error('Expected id and order to be defined in SheetBar');
            tabs.push({ order, id });
          }
        });
        tabs.sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0));
        let toBefore: string | undefined;
        for (let i = 0; i < tabs.length; i++) {
          if (tabs[i].order > down.current.actualOrderIndex) {
            toBefore = tabs[i].id;
            break;
          }
        }
        sheetController.sheets.moveSheet({ id: down.current.id, toBefore });
      }
      down.current = undefined;
    }
  }, [sheetController]);

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string; name: string } | undefined>();
  const handleContextEvent = useCallback((event: MouseEvent, sheet: Sheet) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, name: sheet.name, id: sheet.id });
  }, []);

  const [forceRename, setForceRename] = useState<string | undefined>();
  const handleRename = useCallback(() => {
    if (!contextMenu || !sheets) return;
    setForceRename(contextMenu.id);
    setContextMenu(undefined);
  }, [contextMenu, sheets]);
  const clearRename = useCallback(() => setForceRename(undefined), []);

  return (
    <div className="sheet-bar">
      <div className="sheet-bar-add">
        <button
          onClick={() => {
            sheetController.sheets.createNew();
            focusGrid();
          }}
        >
          +
        </button>
        <div
          className="sheet-bar-sheets"
          ref={sheetsRef}
          onWheel={(e) => {
            if (!sheets) return;
            if (e.deltaX) {
              sheets.scrollLeft += e.deltaX;
            }
          }}
        >
          {sheetController.sheets.map((sheet) => (
            <SheetBarTab
              key={sheet.id}
              order={getOrderIndex(sheet.order).toString()}
              onPointerDown={handlePointerDown}
              onContextMenu={handleContextEvent}
              active={activeSheet === sheet.id}
              sheet={sheet}
              sheetController={sheetController}
              forceRename={forceRename === sheet.id}
              clearRename={clearRename}
            />
          ))}
        </div>
      </div>
      <div className="sheet-bar-arrows">
        <button
          className="sheet-bar-arrow"
          ref={leftRef}
          onPointerDown={() => handleArrowDown(-1)}
          onPointerUp={handleArrowUp}
        >
          <ChevronLeft />
        </button>
        <button
          className="sheet-bar-arrow"
          ref={rightRef}
          onPointerDown={() => handleArrowDown(1)}
          onPointerUp={handleArrowUp}
        >
          <ChevronRight />
        </button>
      </div>
      <SheetBarTabContextMenu
        sheetController={sheetController}
        contextMenu={contextMenu}
        handleClose={() => setContextMenu(undefined)}
        handleRename={handleRename}
      />
    </div>
  );
};
