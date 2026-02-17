//! The formatting bar automatically resizes to fit the available space, showing
//! leftovers in a submenu.

import { editorInteractionStateTransactionsInfoAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorEvents } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorEvents';
import type { SpanFormatting } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorSpans';
import { isEmbed } from '@/app/helpers/isEmbed';
import type { CellFormatSummary } from '@/app/quadratic-core-types';
import { FormatPainterButton } from '@/app/ui/menus/Toolbar/FormatPainterButton';
import {
  AlignmentFormatting,
  Clear,
  DateFormatting,
  FillAndBorderFormatting,
  FontSizeFormatting,
  FormatMoreButton,
  InsertLinkFormatting,
  NumberFormatting,
  TextFormatting,
} from '@/app/ui/menus/Toolbar/FormattingBar/panels';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/shadcn/ui/popover';
import { cn } from '@/shared/shadcn/utils';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useRecoilValue } from 'recoil';

const FORMATTING_BAR_MEASUREMENT_CONTAINER_ID = 'formatting-bar-measurement-container';

type FormattingTypes =
  | 'NumberFormatting'
  | 'DateFormatting'
  | 'TextFormatting'
  | 'FontSizeFormatting'
  | 'FillAndBorderFormatting'
  | 'AlignmentFormatting'
  | 'Clear'
  | 'InsertLinkFormatting';

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
  const insertLinkFormattingRef = useRef<HTMLDivElement>(null);
  const formatPainterRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);

  // Use a single permanent offscreen container for the measurement portal so React
  // never has to remove a direct child of document.body, avoiding removeChild
  // conflicts with Radix and other code that also use body (e.g. after sheet load).
  useLayoutEffect(() => {
    let container = document.getElementById(FORMATTING_BAR_MEASUREMENT_CONTAINER_ID) as HTMLDivElement | null;
    if (!container) {
      container = document.createElement('div');
      container.id = FORMATTING_BAR_MEASUREMENT_CONTAINER_ID;
      container.style.cssText = 'position:fixed;left:-9999px;top:0;pointer-events:none;';
      document.body.appendChild(container);
    }
    setPortalContainer(container);
    // Container is intentionally left in the DOM on unmount to avoid removeChild
    // races and so it can be reused on next mount (single shared ID = at most one node).
    return () => setPortalContainer(null);
  }, []);

  useEffect(() => {
    const refs: Record<FormattingTypes, RefObject<HTMLDivElement | null>> = {
      NumberFormatting: numberFormattingRef,
      DateFormatting: dateFormattingRef,
      TextFormatting: textFormattingRef,
      FontSizeFormatting: fontSizeFormattingRef,
      FillAndBorderFormatting: fillAndBorderFormattingRef,
      AlignmentFormatting: alignmentFormattingRef,
      Clear: clearRef,
      InsertLinkFormatting: insertLinkFormattingRef,
    };

    // check if any of the formatting groups are too wide to fit on the formatting bar
    const checkFit = () => {
      // ensure all refs are defined before checking fit
      if (!menuRef.current) return;
      for (const ref in refs) {
        if (!refs[ref as FormattingTypes].current) return;
      }

      const menuWidth = menuRef.current?.clientWidth;
      const moreButtonWidth = moreButtonRef.current?.clientWidth ?? 0;
      const formatPainterWidth = formatPainterRef.current?.clientWidth ?? 0;

      // First, calculate total width without more button (include FormatPainterButton
      // since it's always visible and never moves to the overflow menu)
      let totalWidth = formatPainterWidth;
      Object.entries(refs).forEach(([key, ref]) => {
        const itemWidth = ref.current?.clientWidth;
        if (itemWidth) {
          totalWidth += itemWidth;
        }
      });

      // If everything fits without more button, show everything
      if (totalWidth <= menuWidth) {
        setHiddenItems([]);
        return;
      }

      // Otherwise, find which items to hide accounting for more button and FormatPainterButton widths
      let currentWidth = moreButtonWidth + formatPainterWidth;
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

    // Use ResizeObserver to detect container width changes (works for initial render
    // and when embed/container size changes without a window resize event)
    const resizeObserver = new ResizeObserver(checkFit);
    if (menuRef.current) {
      resizeObserver.observe(menuRef.current);
    }

    // Also listen to window resize as a fallback
    window.addEventListener('resize', checkFit);

    // Run checkFit after a frame to ensure layout is calculated
    const rafId = requestAnimationFrame(checkFit);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', checkFit);
      cancelAnimationFrame(rafId);
    };
  }, [portalContainer]);

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

  // Track selection formatting from inline editor
  const [selectionFormatting, setSelectionFormatting] = useState<SpanFormatting | undefined>(undefined);
  useEffect(() => {
    const handleSelectionFormatting = (formatting: SpanFormatting | undefined) => {
      setSelectionFormatting(formatting);
    };

    inlineEditorEvents.on('selectionFormatting', handleSelectionFormatting);
    return () => {
      inlineEditorEvents.off('selectionFormatting', handleSelectionFormatting);
    };
  }, []);

  // Compute the effective format summary, overriding with selection formatting when there's a selection
  const effectiveFormatSummary = useMemo((): CellFormatSummary | undefined => {
    if (!formatSummary) return undefined;

    // If there's no selection formatting, use the cell's format summary
    if (!selectionFormatting) return formatSummary;

    // Override text formatting properties with selection formatting
    return {
      ...formatSummary,
      bold: selectionFormatting.bold ?? false,
      italic: selectionFormatting.italic ?? false,
      underline: selectionFormatting.underline ?? false,
      strikeThrough: selectionFormatting.strikeThrough ?? false,
      textColor: selectionFormatting.textColor ?? null,
    };
  }, [formatSummary, selectionFormatting]);

  return (
    <>
      {portalContainer &&
        createPortal(
          <div className="absolute -left-[10000px] -top-[10000px] z-[10000]">
            <div id="measurement-container" className="flex w-fit flex-row">
              <NumberFormatting ref={numberFormattingRef} formatSummary={formatSummary} hideLabel={true} />
              <DateFormatting ref={dateFormattingRef} hideLabel={true} />
              <TextFormatting ref={textFormattingRef} formatSummary={formatSummary} hideLabel={true} />
              <FontSizeFormatting ref={fontSizeFormattingRef} formatSummary={formatSummary} hideLabel={true} />
              <FillAndBorderFormatting
                ref={fillAndBorderFormattingRef}
                formatSummary={formatSummary}
                hideLabel={true}
              />
              <AlignmentFormatting ref={alignmentFormattingRef} formatSummary={formatSummary} hideLabel={true} />
              <Clear ref={clearRef} hideLabel={true} />
              <InsertLinkFormatting ref={insertLinkFormattingRef} hideLabel={true} />
              <div ref={formatPainterRef}>
                <FormatPainterButton />
              </div>
              <FormatMoreButton ref={moreButtonRef} setShowMore={setShowMore} showMore={showMore} />
            </div>
          </div>,
          portalContainer
        )}

      <div className="flex h-full min-w-0 flex-1 overflow-hidden" ref={menuRef}>
        <div className="flex h-full w-full justify-center">
          <div className="flex flex-shrink select-none items-center">
            {!hiddenItems.includes('NumberFormatting') && (
              <NumberFormatting key="main-number-formatting" formatSummary={formatSummary} />
            )}
            {!hiddenItems.includes('DateFormatting') && <DateFormatting key="main-date-formatting" />}
            {!hiddenItems.includes('TextFormatting') && (
              <TextFormatting key="main-text-formatting" formatSummary={effectiveFormatSummary} />
            )}
            {!hiddenItems.includes('FontSizeFormatting') && (
              <FontSizeFormatting key="main-font-size-formatting" formatSummary={formatSummary} />
            )}
            <FormatPainterButton />
            {!hiddenItems.includes('FillAndBorderFormatting') && (
              <FillAndBorderFormatting key="main-fill-and-border-formatting" formatSummary={formatSummary} />
            )}
            {!hiddenItems.includes('AlignmentFormatting') && (
              <AlignmentFormatting key="main-alignment-formatting" formatSummary={formatSummary} />
            )}
            {!hiddenItems.includes('Clear') && <Clear key="main-clear" />}
            {!hiddenItems.includes('InsertLinkFormatting') && (
              <InsertLinkFormatting key="main-insert-link-formatting" />
            )}
          </div>

          {hiddenItems.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <div className="flex select-none">
                  <FormatMoreButton setShowMore={setShowMore} showMore={showMore} />
                </div>
              </PopoverTrigger>
              <PopoverContent className={cn('w-fit p-2', isEmbed ? 'block' : 'hidden md:block')} align="start">
                <div className="flex gap-1 text-sm">
                  {hiddenItems.includes('NumberFormatting') && (
                    <NumberFormatting key="hidden-number-formatting" formatSummary={formatSummary} />
                  )}
                  {hiddenItems.includes('DateFormatting') && <DateFormatting key="hidden-date-formatting" />}
                  {hiddenItems.includes('TextFormatting') && (
                    <TextFormatting key="hidden-text-formatting" formatSummary={effectiveFormatSummary} />
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
                  {hiddenItems.includes('InsertLinkFormatting') && (
                    <InsertLinkFormatting key="hidden-insert-link-formatting" />
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
    </>
  );
});
