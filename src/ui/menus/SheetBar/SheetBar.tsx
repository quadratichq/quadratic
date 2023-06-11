import './SheetBar.css';

import { SheetController } from '../../../grid/controller/sheetController';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SheetBarTab } from './SheetBarTab';
import { ButtonUnstyled } from '@mui/material';
import { Sheet } from '../../../grid/sheet/Sheet';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';

interface Props {
  sheetController: SheetController;
}

const ARROW_SCROLL_AMOUNT = 10;
const HOVER_SCROLL_AMOUNT = 5;
const SCROLLING_INTERVAL = 17;
const ARROW_REPEAT_INTERVAL = 17;

export const SheetBar = (props: Props): JSX.Element => {
  const { sheetController } = props;

  // activate sheet
  const [activeSheet, setActiveSheet] = useState(sheetController.current);
  useEffect(() => {
    const updateSheet = () => setActiveSheet(sheetController.current);
    window.addEventListener('sheet-change', updateSheet);
    return () => window.removeEventListener('sheet-change', updateSheet);
  }, [sheetController]);

  // handle disabling left arrow and right arrow
  const [sheets, setSheets] = useState<HTMLDivElement | undefined>();
  const [leftArrow, setLeftArrow] = useState<HTMLElement | undefined>();
  const [rightArrow, setRightArrow] = useState<HTMLElement | undefined>();
  const leftRef = useCallback(
    (node: HTMLElement) => {
      setLeftArrow(node);
      if (!sheets || !node) return;
      const hide = sheets.scrollLeft === 0 || sheets.offsetWidth === sheets.scrollWidth;
      node.style.opacity = hide ? '0.25' : '1';
      node.style.cursor = hide ? 'auto' : 'pointer';
    },
    [sheets]
  );

  const rightRef = useCallback(
    (node: HTMLElement) => {
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
        tab.style.order = down.current.original.toString();
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
        original: number;
        offset: number;
        id: string;
        actualOrder: number;
        overlap?: number;
        scrollWidth: number;
      }
    | undefined
  >();
  const scrolling = useRef<undefined | number>();

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
        down.current = {
          tab,
          offset: event.clientX - rect.left,
          id: sheet.id,
          scrollWidth: sheets.scrollWidth,

          // order is a multiple of 2 so we can move tabs before and after other tabs (order needs to be an integer)
          original: sheet.order * 2,
          actualOrder: sheet.order * 2,
        };
        tab.style.boxShadow = '0.25rem -0.25rem 0.5rem rgba(0,0,0,0.25)';
        tab.style.zIndex = '2';
      }
      event.preventDefault();
    },
    [sheetController, sheets]
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
        const tabs: { rect: DOMRect; order: number; element: HTMLDivElement }[] = [];
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
        const overlap = tabs.find((tab) => mouseX >= tab.rect.left && mouseX <= tab.rect.right);
        if (overlap) {
          if (down.current.overlap !== overlap.order) {
            // ensure we only use the overlapping tab one time
            down.current.overlap = overlap.order;

            // moving left
            if (down.current.actualOrder > overlap.order) {
              if (down.current.original > overlap.order) {
                tab.style.order = (overlap.order - 1).toString();
              } else {
                tab.style.order = overlap.order.toString();
              }
              down.current.actualOrder = overlap.order - 1;
            }

            // moving right
            else {
              // each tab has order * 2, so there's a space next to each tab.order + 1
              if (down.current.original < overlap.order) {
                tab.style.order = (overlap.order + 1).toString();
              } else {
                tab.style.order = overlap.order.toString();
              }
              down.current.actualOrder = overlap.order + 1;
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
    [sheets]
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
      if (down.current.actualOrder !== down.current.original) {
        sheetController.reorderSheet(down.current.id, down.current.actualOrder / 2);
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

  return (
    <div className="sheet-bar">
      <div className="sheet-bar-add">
        <ButtonUnstyled
          onClick={() => {
            sheetController.addSheet();
            setActiveSheet(sheetController.current);
          }}
        >
          +
        </ButtonUnstyled>
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
              onPointerDown={handlePointerDown}
              active={activeSheet === sheet.id}
              sheet={sheet}
              sheetController={sheetController}
            />
          ))}
        </div>
      </div>
      <div className="sheet-bar-arrows">
        <ButtonUnstyled
          className="sheet-bar-arrow"
          ref={leftRef}
          onPointerDown={() => handleArrowDown(-1)}
          onPointerUp={handleArrowUp}
        >
          <ChevronLeft />
        </ButtonUnstyled>
        <ButtonUnstyled
          className="sheet-bar-arrow"
          ref={rightRef}
          onPointerDown={() => handleArrowDown(1)}
          onPointerUp={handleArrowUp}
        >
          <ChevronRight />
        </ButtonUnstyled>
      </div>
    </div>
  );
};
