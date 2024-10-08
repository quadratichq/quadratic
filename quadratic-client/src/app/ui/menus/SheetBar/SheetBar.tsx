import { hasPermissionToEditFile } from '@/app/actions';
import { editorInteractionStatePermissionsAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { Sheet } from '@/app/grid/sheet/Sheet';
import { focusGrid } from '@/app/helpers/focusGrid';
import { SheetBarButton } from '@/app/ui/menus/SheetBar/SheetBarButton';
import { SheetBarTab } from '@/app/ui/menus/SheetBar/SheetBarTab';
import { AddIcon, ChevronLeftIcon, ChevronRightIcon } from '@/shared/components/Icons';
import mixpanel from 'mixpanel-browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isMobile } from 'react-device-detect';
import { useRecoilValue } from 'recoil';

const ARROW_SCROLL_AMOUNT = 10;
const HOVER_SCROLL_AMOUNT = 5;
const SCROLLING_INTERVAL = 17;
const ARROW_REPEAT_INTERVAL = 17;

export const SheetBar = (): JSX.Element => {
  // used to trigger state change (eg, when sheets change)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, setTrigger] = useState(0);

  const permissions = useRecoilValue(editorInteractionStatePermissionsAtom);
  const hasPermission = useMemo(() => hasPermissionToEditFile(permissions) && !isMobile, [permissions]);

  // activate sheet
  const [activeSheet, setActiveSheet] = useState(sheets.current);

  const dragTimeOut = useRef<number | undefined>();

  useEffect(() => {
    const updateSheet = () => {
      setActiveSheet(sheets.current);
      setTrigger((trigger) => trigger + 1);
    };

    events.on('changeSheet', updateSheet);
    return () => {
      events.off('changeSheet', updateSheet);
    };
  }, []);

  // handle disabling left arrow and right arrow
  const [sheetTabs, setSheetTabs] = useState<HTMLDivElement | undefined>();
  const [leftArrow, setLeftArrow] = useState<HTMLButtonElement | undefined>();
  const [rightArrow, setRightArrow] = useState<HTMLButtonElement | undefined>();
  const leftRef = useCallback(
    (node: HTMLButtonElement) => {
      setLeftArrow(node);
      if (!sheetTabs || !node) return;
      const hide = sheetTabs.scrollLeft === 0 || sheetTabs.offsetWidth === sheetTabs.scrollWidth;
      node.disabled = hide;
    },
    [sheetTabs]
  );

  const rightRef = useCallback(
    (node: HTMLButtonElement) => {
      setRightArrow(node);
      if (!sheetTabs || !node) return;
      const hide =
        sheetTabs.offsetWidth === sheetTabs.scrollWidth ||
        Math.round(sheetTabs.scrollLeft) === Math.round(sheetTabs.scrollWidth - sheetTabs.offsetWidth);
      node.disabled = hide;
    },
    [sheetTabs]
  );
  const sheetsRef = useCallback(
    (node: HTMLDivElement) => {
      setSheetTabs(node);
      if (!node) return;
      node.addEventListener('scroll', () => {
        if (leftArrow) {
          const hide = node.scrollLeft === 0 || node.offsetWidth === node.scrollWidth;
          leftArrow.disabled = hide;
        }
        if (rightArrow) {
          const hide =
            node.offsetWidth === node.scrollWidth ||
            Math.round(node.scrollLeft) === Math.round(node.scrollWidth - node.offsetWidth);
          rightArrow.disabled = hide;
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
        // tab.scrollIntoView();
        down.current = undefined;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

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
  const getOrderIndex = useCallback((order: string): number => {
    const orders = sheets.map((sheet) => sheet.order);
    if (orders.length === 0) {
      return 0;
    }
    for (let i = 0; i < orders.length; i++) {
      if (order < orders[i]) {
        return i * 2;
      }
    }
    return orders.length * 2;
  }, []);

  const handlePointerDown = useCallback(
    (options: { event: React.PointerEvent<HTMLDivElement>; sheet: Sheet }) => {
      const { event, sheet } = options;

      if (!sheetTabs) return;

      setActiveSheet((prevState: string) => {
        if (prevState !== sheet.id) {
          sheets.current = sheet.id;
          setActiveSheet(sheet.id);
          return sheet.id;
        }
        return prevState;
      });

      // don't drag on context menu via right click or ctrl+click
      if (event.button === 2 || (event.ctrlKey === true && event.button === 0)) return;

      // If they don't have the permission, don't allow past here for drag to reorder
      if (!hasPermission) return;

      event.preventDefault();
      const tab = event.currentTarget;
      if (tab) {
        const rect = tab.getBoundingClientRect();
        rect.x -= sheetTabs.offsetLeft;
        const originalOrderIndex = getOrderIndex(sheet.order);
        down.current = {
          tab,
          offset: event.clientX - rect.left,
          id: sheet.id,
          scrollWidth: sheetTabs.scrollWidth,
          originalOrder: sheet.order,
          originalOrderIndex,
          actualOrderIndex: originalOrderIndex,
        };
        dragTimeOut.current = window.setTimeout(() => {
          if (down.current) {
            tab.style.boxShadow = '0rem -0.5rem 0.75rem rgba(0,0,0,0.25)';
          }
        }, 500);
        tab.style.zIndex = '2';
      }
      focusGrid();
    },
    [getOrderIndex, sheetTabs, hasPermission]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const tab = down.current?.tab;
      if (!tab || !sheetTabs) return;

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
        const left = event.clientX - tab.offsetLeft + sheetTabs.scrollLeft - down.current.offset;
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
        if (sheetTabs.offsetWidth !== down.current.scrollWidth) {
          // scroll to the right if necessary
          if (
            event.clientX > sheetTabs.offsetLeft + sheetTabs.offsetWidth &&
            sheetTabs.scrollLeft < down.current.scrollWidth - sheetTabs.offsetWidth
          ) {
            if (scrolling.current) return;
            clearScrollingInterval();
            scrolling.current = window.setInterval(() => {
              if (!down.current) return;
              if (sheetTabs.scrollLeft < down.current.scrollWidth - sheetTabs.offsetWidth + tab.offsetWidth) {
                sheetTabs.scrollLeft += HOVER_SCROLL_AMOUNT;
              } else {
                sheetTabs.scrollLeft = down.current.scrollWidth - sheetTabs.offsetWidth;
                clearScrollingInterval();
              }
              checkPosition(event.clientX);
              positionTab();
            }, SCROLLING_INTERVAL);
          }

          // scroll to the left
          else if (event.clientX < sheetTabs.offsetLeft && sheetTabs.scrollLeft !== 0) {
            clearScrollingInterval();
            scrolling.current = window.setInterval(() => {
              if (!down.current) return;
              if (sheetTabs.scrollLeft !== 0) {
                sheetTabs.scrollLeft -= HOVER_SCROLL_AMOUNT;
              } else {
                sheetTabs.scrollLeft = 0;
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
    [getOrderIndex, sheetTabs]
  );

  const scrollInterval = useRef<number | undefined>();
  const handleArrowDown = useCallback(
    (direction: number) => {
      if (scrollInterval.current) {
        window.clearInterval(scrollInterval.current);
      }
      if (sheetTabs) {
        sheetTabs.scrollLeft += ARROW_SCROLL_AMOUNT * direction;
        scrollInterval.current = window.setInterval(
          () => (sheetTabs.scrollLeft += ARROW_SCROLL_AMOUNT * direction),
          ARROW_REPEAT_INTERVAL
        );
      }
    },
    [sheetTabs]
  );
  const handleArrowUp = useCallback(() => {
    if (scrollInterval.current) {
      window.clearInterval(scrollInterval.current);
      scrollInterval.current = undefined;
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    if (dragTimeOut.current) {
      window.clearTimeout(dragTimeOut.current);
      dragTimeOut.current = undefined;
    }
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
        const sheet = sheets.getById(down.current.id);
        if (!sheet) {
          throw new Error('Expect sheet to be defined in SheetBar.pointerUp');
        }
        const tabs: { order: number; id: string }[] = [];
        down.current.tab.parentElement?.childNodes.forEach((node) => {
          const element = node as HTMLDivElement;
          if (element !== tab) {
            const order = element.getAttribute('data-actual-order');
            const id = element.getAttribute('data-id');
            if (!id || !order) throw new Error('Expected id and order to be defined in SheetBar');
            tabs.push({ order: parseInt(order), id });
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
        sheets.moveSheet({ id: down.current.id, toBefore });
      }
      down.current = undefined;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const [forceRename, setForceRename] = useState<string | undefined>();
  const clearRename = useCallback(() => setForceRename(undefined), []);

  return (
    <div className="align-stretch z-[1] flex h-8 flex-shrink-0 select-none flex-row justify-between bg-background text-xs text-muted-foreground">
      {hasPermission && (
        <SheetBarButton
          onClick={() => {
            mixpanel.track('[Sheets].add');
            sheets.userAddSheet();
            focusGrid();
          }}
          className="rounded-none border-r border-t border-border"
          tooltip="Add sheet"
        >
          <AddIcon />
        </SheetBarButton>
      )}

      <div
        className="-ml-[1px] flex flex-shrink flex-grow flex-row overflow-hidden pt-[1px] shadow-[inset_0_1px_0_hsl(var(--border))]"
        ref={sheetsRef}
        onWheel={(e) => {
          if (!sheetTabs) return;
          if (e.deltaX) {
            sheetTabs.scrollLeft += e.deltaX;
          }
        }}
      >
        {sheets.map((sheet) => (
          <SheetBarTab
            key={sheet.id}
            order={getOrderIndex(sheet.order).toString()}
            onPointerDown={handlePointerDown}
            active={activeSheet === sheet.id}
            sheet={sheet}
            forceRename={forceRename === sheet.id}
            clearRename={clearRename}
          />
        ))}
      </div>

      <div className="flex border-t border-border">
        <SheetBarButton
          buttonRef={leftRef}
          onPointerDown={() => handleArrowDown(-1)}
          onPointerUp={handleArrowUp}
          tooltip="Scroll left"
        >
          <ChevronLeftIcon />
        </SheetBarButton>

        <SheetBarButton
          buttonRef={rightRef}
          onPointerDown={() => handleArrowDown(1)}
          onPointerUp={handleArrowUp}
          tooltip="Scroll right"
        >
          <ChevronRightIcon />
        </SheetBarButton>
      </div>
    </div>
  );
};
