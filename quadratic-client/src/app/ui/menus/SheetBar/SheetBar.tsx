import { hasPermissionToEditFile } from '@/app/actions';
import { editorInteractionStatePermissionsAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { Sheet } from '@/app/grid/sheet/Sheet';
import { focusGrid } from '@/app/helpers/focusGrid';
import { SheetBarButton } from '@/app/ui/menus/SheetBar/SheetBarButton';
import { SheetBarTab } from '@/app/ui/menus/SheetBar/SheetBarTab';
import { AddIcon, ChevronLeftIcon, ChevronRightIcon } from '@/shared/components/Icons';
import { SEARCH_PARAMS } from '@/shared/constants/routes';
import { useUpdateQueryStringValueWithoutNavigation } from '@/shared/hooks/useUpdateQueryStringValueWithoutNavigation';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import type { JSX } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isMobile } from 'react-device-detect';
import { useRecoilValue } from 'recoil';

const ARROW_SCROLL_AMOUNT = 10;
const HOVER_SCROLL_AMOUNT = 5;
const SCROLLING_INTERVAL = 17;
const ARROW_REPEAT_INTERVAL = 17;

export const SheetBar = memo((): JSX.Element => {
  // used to trigger state change (eg, when sheets change)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, setTrigger] = useState(0);

  const permissions = useRecoilValue(editorInteractionStatePermissionsAtom);
  const hasPermission = useMemo(() => hasPermissionToEditFile(permissions) && !isMobile, [permissions]);
  const dragTimeOut = useRef<number | undefined>(undefined);

  // Use useRef to store the initial active sheet ID
  const [activeSheet, setActiveSheet] = useState(sheets.current);

  // Update the URL with the active sheet (if it's not the first sheet)
  useUpdateQueryStringValueWithoutNavigation(
    SEARCH_PARAMS.SHEET.KEY,
    sheets.getFirst().id === activeSheet ? null : activeSheet
  );

  // Update internal state of the active sheet when user changes sheet
  useEffect(() => {
    const updateSheet = () => {
      setActiveSheet(sheets.current);
      setTrigger((trigger) => trigger + 1);
    };

    events.on('changeSheet', updateSheet);
    events.on('deleteSheet', updateSheet);
    events.on('sheetInfoUpdate', updateSheet);
    return () => {
      events.off('changeSheet', updateSheet);
      events.off('deleteSheet', updateSheet);
      events.off('sheetInfoUpdate', updateSheet);
    };
  }, []);

  useEffect(() => {
    if (activeSheet !== sheets.current) {
      sheets.current = activeSheet;
    }
  }, [activeSheet]);

  // handle disabling left arrow and right arrow
  const sheetBarRef = useRef<HTMLDivElement>(null);
  const sheetTabRef = useRef<HTMLDivElement | null>(null);
  const leftArrowRef = useRef<HTMLButtonElement | null>(null);
  const rightArrowRef = useRef<HTMLButtonElement | null>(null);

  const leftRef = useCallback((node: HTMLButtonElement) => {
    leftArrowRef.current = node;
    if (!sheetTabRef.current || !node) return;
    const hide =
      sheetTabRef.current.scrollLeft === 0 || sheetTabRef.current.offsetWidth === sheetTabRef.current.scrollWidth;
    node.disabled = hide;
  }, []);

  const rightRef = useCallback((node: HTMLButtonElement) => {
    rightArrowRef.current = node;
    if (!sheetTabRef.current || !node) return;
    const hide =
      sheetTabRef.current.offsetWidth === sheetTabRef.current.scrollWidth ||
      Math.round(sheetTabRef.current.scrollLeft) ===
        Math.round(sheetTabRef.current.scrollWidth - sheetTabRef.current.offsetWidth);
    node.disabled = hide;
  }, []);

  const sheetTabsRef = useCallback((node: HTMLDivElement) => {
    sheetTabRef.current = node;
    if (!node) return;
    node.addEventListener('scroll', () => {
      if (leftArrowRef.current) {
        const hide = node.scrollLeft === 0 || node.offsetWidth === node.scrollWidth;
        leftArrowRef.current.disabled = hide;
      }
      if (rightArrowRef.current) {
        const hide =
          node.offsetWidth === node.scrollWidth ||
          Math.round(node.scrollLeft) === Math.round(node.scrollWidth - node.offsetWidth);
        rightArrowRef.current.disabled = hide;
      }
    });
  }, []);

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
  >(undefined);
  const scrolling = useRef<number | undefined>(undefined);

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

      if (!sheetTabRef.current) return;

      setActiveSheet(sheet.id);

      // don't drag on context menu via right click or ctrl+click
      if (event.button === 2 || (event.ctrlKey === true && event.button === 0)) return;

      // If they don't have the permission, don't allow past here for drag to reorder
      if (!hasPermission) return;

      event.preventDefault();
      const tab = event.currentTarget;
      if (tab) {
        const rect = tab.getBoundingClientRect();
        rect.x -= sheetBarRef.current?.getBoundingClientRect().left ?? 0;
        const originalOrderIndex = getOrderIndex(sheet.order);
        down.current = {
          tab,
          offset: event.clientX - rect.left,
          id: sheet.id,
          scrollWidth: sheetTabRef.current.scrollWidth,
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
    [getOrderIndex, hasPermission]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const tab = down.current?.tab;
      if (!tab || !sheetTabRef.current) return;

      // clears scrolling interval
      const clearScrollingInterval = () => {
        if (scrolling.current !== undefined) {
          window.clearInterval(scrolling.current);
          scrolling.current = undefined;
        }
      };

      // positions dragging div
      const positionTab = () => {
        if (!down.current || !sheetTabRef.current) return;
        const left = event.clientX - tab.offsetLeft + sheetTabRef.current.scrollLeft - down.current.offset;
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
        if (sheetTabRef.current.offsetWidth !== down.current.scrollWidth) {
          const sheetTabsLeft = sheetTabRef.current.getBoundingClientRect().left;
          // scroll to the right if necessary
          if (
            event.clientX > sheetTabsLeft + sheetTabRef.current.offsetWidth &&
            sheetTabRef.current.scrollLeft < down.current.scrollWidth - sheetTabRef.current.offsetWidth
          ) {
            if (scrolling.current) return;
            clearScrollingInterval();
            scrolling.current = window.setInterval(() => {
              if (!down.current || !sheetTabRef.current) return;
              if (
                sheetTabRef.current.scrollLeft <
                down.current.scrollWidth - sheetTabRef.current.offsetWidth + tab.offsetWidth
              ) {
                sheetTabRef.current.scrollLeft += HOVER_SCROLL_AMOUNT;
              } else {
                sheetTabRef.current.scrollLeft = down.current.scrollWidth - sheetTabRef.current.offsetWidth;
                clearScrollingInterval();
              }
              checkPosition(event.clientX);
              positionTab();
            }, SCROLLING_INTERVAL);
          }

          // scroll to the left
          else if (event.clientX < sheetTabsLeft && sheetTabRef.current.scrollLeft !== 0) {
            clearScrollingInterval();
            scrolling.current = window.setInterval(() => {
              if (!down.current || !sheetTabRef.current) return;
              if (sheetTabRef.current.scrollLeft !== 0) {
                sheetTabRef.current.scrollLeft -= HOVER_SCROLL_AMOUNT;
              } else {
                sheetTabRef.current.scrollLeft = 0;
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
    [getOrderIndex]
  );

  const scrollInterval = useRef<number | undefined>(undefined);
  const handleArrowDown = useCallback((direction: number) => {
    if (scrollInterval.current) {
      window.clearInterval(scrollInterval.current);
    }
    if (sheetTabRef.current) {
      sheetTabRef.current.scrollLeft += ARROW_SCROLL_AMOUNT * direction;
      scrollInterval.current = window.setInterval(() => {
        if (sheetTabRef.current) {
          sheetTabRef.current.scrollLeft += ARROW_SCROLL_AMOUNT * direction;
        }
      }, ARROW_REPEAT_INTERVAL);
    }
  }, []);
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
    <div
      ref={sheetBarRef}
      className="pointer-up-ignore align-stretch z-[1] flex h-8 flex-shrink-0 select-none flex-row justify-between bg-background text-xs"
    >
      {hasPermission && (
        <SheetBarButton
          onClick={() => {
            trackEvent('[Sheets].add');
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
        ref={sheetTabsRef}
        className="-ml-[1px] flex flex-shrink flex-grow flex-row overflow-hidden pt-[1px] shadow-[inset_0_1px_0_hsl(var(--border))]"
        onWheel={(e) => {
          if (sheetTabRef.current && e.deltaX) {
            sheetTabRef.current.scrollLeft += e.deltaX;
          }
        }}
      >
        {sheets.map((sheet) => (
          <SheetBarTab
            data-testid={`sheet-${sheet.name}`}
            key={sheet.id}
            id={sheet.id}
            color={sheet.color}
            name={sheet.name}
            order={sheet.order}
            calculatedOrder={getOrderIndex(sheet.order).toString()}
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
});
