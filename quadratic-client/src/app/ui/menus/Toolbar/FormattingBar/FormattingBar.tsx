//! The formatting bar automatically resizes to fit the available space, showing
//! leftovers in a submenu.

import { editorInteractionStateTransactionsInfoAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { CellFormatSummary } from '@/app/quadratic-core-types';
import {
  AlignmentFormatting,
  Clear,
  DateFormatting,
  FillAndBorderFormatting,
  FontSizeFormatting,
  FormatMoreButton,
  NumberFormatting,
  TextFormatting,
} from '@/app/ui/menus/Toolbar/FormattingBar/panels';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/shadcn/ui/popover';
import { memo, useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useRecoilValue } from 'recoil';

type FormattingTypes =
  | 'NumberFormatting'
  | 'DateFormatting'
  | 'TextFormatting'
  | 'FontSizeFormatting'
  | 'FillAndBorderFormatting'
  | 'AlignmentFormatting'
  | 'Clear';

export const FormattingBar = memo(() => {
  const [hiddenItems, setHiddenItems] = useState<FormattingTypes[]>([]);
  const [showMore, setShowMore] = useState(false);

  const numberFormattingRef = useRef<HTMLDivElement>(null);
  const dateFormattingRef = useRef<HTMLDivElement>(null);
  const textFormattingRef = useRef<HTMLDivElement>(null);
  const fontSizeFormattingRef = useRef<HTMLDivElement>(null);
  const fillAndBorderFormattingRef = useRef<HTMLDivElement>(null);
  const alignmentFormattingRef = useRef<HTMLDivElement>(null);
  const clearRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refs: Record<FormattingTypes, RefObject<HTMLDivElement | null>> = {
      NumberFormatting: numberFormattingRef,
      DateFormatting: dateFormattingRef,
      TextFormatting: textFormattingRef,
      FontSizeFormatting: fontSizeFormattingRef,
      FillAndBorderFormatting: fillAndBorderFormattingRef,
      AlignmentFormatting: alignmentFormattingRef,
      Clear: clearRef,
    };

    // check if any of the formatting groups are too wide to fit on the formatting bar
    const checkFit = () => {
      // ensure all refs are defined before checking fit
      if (!menuRef.current) return;
      for (const ref in refs) {
        if (!refs[ref as FormattingTypes].current) return;
      }

      const menuWidth = menuRef.current?.clientWidth;
      let currentWidth = moreButtonRef.current?.clientWidth ?? 0;
      const hiddenItems: FormattingTypes[] = [];
      Object.entries(refs).forEach(([key, ref]) => {
        const itemWidth = ref.current?.clientWidth;
        if (itemWidth) {
          currentWidth += itemWidth;
          if (currentWidth > menuWidth) {
            hiddenItems.push(key as FormattingTypes);
          }
        }
      });

      // the last item is the same size as the more button, so show the last
      // item instead if it's the only item hidden
      if (hiddenItems.length === 1) {
        hiddenItems.pop();
      }
      setHiddenItems(hiddenItems);
    };

    checkFit();
    window.addEventListener('resize', checkFit);
    return () => {
      window.removeEventListener('resize', checkFit);
    };
  }, []);

  // get the format summary for the current selection
  const [formatSummary, setFormatSummary] = useState<CellFormatSummary | undefined>(undefined);
  const transactionsInfo = useRecoilValue(editorInteractionStateTransactionsInfoAtom);
  useEffect(() => {
    const updateFormatSummary = async () => {
      // don't update the format summary if there are transactions in progress
      if (transactionsInfo.length > 0) return;
      try {
        const summary = await quadraticCore.getFormatSelection(sheets.sheet.cursor.save());
        if (summary && 'error' in summary) {
          console.error('[FormattingBar] Error getting format summary', summary.error);
        } else {
          setFormatSummary(summary);
        }
      } catch (e) {
        console.error('[FormattingBar] Error getting format summary', e);
      }
    };
    updateFormatSummary();

    events.on('cursorPosition', updateFormatSummary);
    return () => {
      events.off('cursorPosition', updateFormatSummary);
    };
  }, [transactionsInfo.length]);

  return (
    <>
      {createPortal(
        <div className="absolute -left-[10000px] -top-[10000px] z-[10000]">
          <div id="measurement-container" className="flex w-fit flex-row">
            <NumberFormatting ref={numberFormattingRef} formatSummary={formatSummary} hideLabel={true} />
            <DateFormatting ref={dateFormattingRef} hideLabel={true} />
            <TextFormatting ref={textFormattingRef} formatSummary={formatSummary} hideLabel={true} />
            <FontSizeFormatting ref={fontSizeFormattingRef} formatSummary={formatSummary} hideLabel={true} />
            <FillAndBorderFormatting ref={fillAndBorderFormattingRef} formatSummary={formatSummary} hideLabel={true} />
            <AlignmentFormatting ref={alignmentFormattingRef} formatSummary={formatSummary} hideLabel={true} />
            <Clear ref={clearRef} hideLabel={true} />
            <FormatMoreButton ref={moreButtonRef} setShowMore={setShowMore} showMore={showMore} />
          </div>
        </div>,
        document.body
      )}

      <div className="flex h-full w-full flex-grow" ref={menuRef}>
        <div className="flex h-full w-full justify-center">
          <div className="flex flex-shrink select-none">
            {!hiddenItems.includes('NumberFormatting') && (
              <NumberFormatting key="main-number-formatting" formatSummary={formatSummary} />
            )}
            {!hiddenItems.includes('DateFormatting') && <DateFormatting key="main-date-formatting" />}
            {!hiddenItems.includes('TextFormatting') && (
              <TextFormatting key="main-text-formatting" formatSummary={formatSummary} />
            )}
            {!hiddenItems.includes('FontSizeFormatting') && (
              <FontSizeFormatting key="main-font-size-formatting" formatSummary={formatSummary} />
            )}
            {!hiddenItems.includes('FillAndBorderFormatting') && (
              <FillAndBorderFormatting key="main-fill-and-border-formatting" formatSummary={formatSummary} />
            )}
            {!hiddenItems.includes('AlignmentFormatting') && (
              <AlignmentFormatting key="main-alignment-formatting" formatSummary={formatSummary} />
            )}
            {!hiddenItems.includes('Clear') && <Clear key="main-clear" />}
          </div>

          {hiddenItems.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <div className="flex select-none">
                  <FormatMoreButton setShowMore={setShowMore} showMore={showMore} />
                </div>
              </PopoverTrigger>
              <PopoverContent className="hidden w-fit p-2 md:block" align="start">
                <div className="flex gap-1 text-sm">
                  {hiddenItems.includes('NumberFormatting') && (
                    <NumberFormatting key="hidden-number-formatting" formatSummary={formatSummary} />
                  )}
                  {hiddenItems.includes('DateFormatting') && <DateFormatting key="hidden-date-formatting" />}
                  {hiddenItems.includes('TextFormatting') && (
                    <TextFormatting key="hidden-text-formatting" formatSummary={formatSummary} />
                  )}
                  {hiddenItems.includes('FontSizeFormatting') && (
                    <FontSizeFormatting key="hidden-font-size-formatting" formatSummary={formatSummary} />
                  )}
                  {hiddenItems.includes('FillAndBorderFormatting') && (
                    <FillAndBorderFormatting key="hidden-fill-and-border-formatting" formatSummary={formatSummary} />
                  )}
                  {hiddenItems.includes('AlignmentFormatting') && (
                    <AlignmentFormatting key="hidden-alignment-formatting" formatSummary={formatSummary} />
                  )}
                  {hiddenItems.includes('Clear') && <Clear key="hidden-clear" />}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
    </>
  );
});
