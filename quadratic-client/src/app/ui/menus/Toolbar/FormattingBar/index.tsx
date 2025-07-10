import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { CellFormatSummary } from '@/app/quadratic-core-types';
import {
  AlignmentFormatting,
  Clear,
  DateFormatting,
  FillAndBorderFormatting,
  FormatMoreButton,
  NumberFormatting,
  TextFormatting,
} from '@/app/ui/menus/Toolbar/FormattingBar/panels';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/shadcn/ui/popover';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';

type FormattingTypes =
  | 'NumberFormatting'
  | 'DateFormatting'
  | 'TextFormatting'
  | 'FillAndBorderFormatting'
  | 'AlignmentFormatting'
  | 'Clear';

export const FormattingBar = () => {
  const [hiddenItems, setHiddenItems] = useState<FormattingTypes[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showMore, setShowMore] = useState(false);

  const moreButtonRef = useRef<HTMLDivElement>(null);
  const numberFormattingRef = useRef<HTMLDivElement>(null);
  const dateFormattingRef = useRef<HTMLDivElement>(null);
  const textFormattingRef = useRef<HTMLDivElement>(null);
  const fillAndBorderFormattingRef = useRef<HTMLDivElement>(null);
  const alignmentFormattingRef = useRef<HTMLDivElement>(null);
  const clearRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refs: Record<FormattingTypes, RefObject<HTMLDivElement | null>> = {
      NumberFormatting: numberFormattingRef,
      DateFormatting: dateFormattingRef,
      TextFormatting: textFormattingRef,
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
      const keys = Object.keys(refs) as FormattingTypes[];
      let currentWidth = moreButtonRef.current?.clientWidth ?? 0;
      const hiddenItems: FormattingTypes[] = [];
      for (const key of keys) {
        const itemWidth = refs[key].current?.clientWidth;
        if (itemWidth) {
          currentWidth += itemWidth;
          if (currentWidth > menuWidth) {
            hiddenItems.push(key);
          }
        }
      }

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

  // create a container to measure the size of the panels of the formatting bar
  let measurementContainer: HTMLDivElement | null = document.querySelector('#measurement-container');
  if (!measurementContainer) {
    measurementContainer = document.createElement('div') as HTMLDivElement;
    measurementContainer.style.position = 'absolute';
    measurementContainer.style.left = '-10000px';
    measurementContainer.style.top = '-10000px';
    measurementContainer.id = 'measurement-container';
    measurementContainer.style.visibility = 'hidden';
    measurementContainer.style.pointerEvents = 'none';
    document.body.appendChild(measurementContainer);
  }

  // get the format summary for the current selection
  const [formatSummary, setFormatSummary] = useState<CellFormatSummary | undefined>(undefined);
  useEffect(() => {
    const updateFormatSummary = async () => {
      const summary = await quadraticCore.getFormatSelection(sheets.sheet.cursor.save());
      setFormatSummary(summary);
    };
    updateFormatSummary();
    events.on('cursorPosition', updateFormatSummary);

    // update the format summary when the transaction ends (which should catch most changes)
    events.on('transactionEnd', updateFormatSummary);
    return () => {
      events.off('cursorPosition', updateFormatSummary);
      events.off('transactionEnd', updateFormatSummary);
    };
  }, []);

  return (
    <>
      {createPortal(
        <div className="flex w-fit flex-row">
          <NumberFormatting ref={numberFormattingRef} formatSummary={formatSummary} />
          <DateFormatting ref={dateFormattingRef} />
          <TextFormatting ref={textFormattingRef} formatSummary={formatSummary} />
          <FillAndBorderFormatting ref={fillAndBorderFormattingRef} />
          <AlignmentFormatting ref={alignmentFormattingRef} formatSummary={formatSummary} />
          <Clear ref={clearRef} />
          <FormatMoreButton ref={moreButtonRef} setShowMore={setShowMore} showMore={showMore} />
        </div>,
        measurementContainer
      )}
      <div className="flex w-full flex-grow" ref={menuRef}>
        <div className="flex w-full justify-center">
          <div className="flex flex-shrink select-none">
            {!hiddenItems.includes('NumberFormatting') && (
              <NumberFormatting key="main-number-formatting" formatSummary={formatSummary} />
            )}
            {!hiddenItems.includes('DateFormatting') && <DateFormatting key="main-date-formatting" />}
            {!hiddenItems.includes('TextFormatting') && (
              <TextFormatting key="main-text-formatting" formatSummary={formatSummary} />
            )}
            {!hiddenItems.includes('FillAndBorderFormatting') && (
              <FillAndBorderFormatting key="main-fill-and-border-formatting" />
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
              <PopoverContent className="w-fit" align="start">
                <div className="flex gap-1 text-sm">
                  {hiddenItems.includes('NumberFormatting') && (
                    <NumberFormatting key="hidden-number-formatting" formatSummary={formatSummary} />
                  )}
                  {hiddenItems.includes('DateFormatting') && <DateFormatting key="hidden-date-formatting" />}
                  {hiddenItems.includes('TextFormatting') && (
                    <TextFormatting key="hidden-text-formatting" formatSummary={formatSummary} />
                  )}
                  {hiddenItems.includes('FillAndBorderFormatting') && (
                    <FillAndBorderFormatting key="hidden-fill-and-border-formatting" />
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
};
