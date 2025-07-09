import {
  AlignmentFormatting,
  Clear,
  DateFormatting,
  FillAndBorderFormatting,
  FormatMoreButton,
  NumberFormatting,
  TextFormatting,
} from '@/app/ui/menus/Toolbar/FormattingBar/panels';
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
      setHiddenItems(hiddenItems);
    };

    checkFit();
    window.addEventListener('resize', checkFit);
    return () => {
      window.removeEventListener('resize', checkFit);
    };
  }, []);

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

  return (
    <>
      {createPortal(
        <div className="flex w-fit flex-row">
          <NumberFormatting ref={numberFormattingRef} />
          <DateFormatting ref={dateFormattingRef} />
          <TextFormatting ref={textFormattingRef} />
          <FillAndBorderFormatting ref={fillAndBorderFormattingRef} />
          <AlignmentFormatting ref={alignmentFormattingRef} />
          <Clear ref={clearRef} />
          <FormatMoreButton ref={moreButtonRef} setShowMore={setShowMore} showMore={showMore} />
        </div>,
        measurementContainer
      )}
      <div className="flex w-full flex-grow" ref={menuRef}>
        <div className="flex w-full justify-center">
          <div className="flex flex-shrink select-none">
            {!hiddenItems.includes('NumberFormatting') && <NumberFormatting />}
            {!hiddenItems.includes('DateFormatting') && <DateFormatting />}
            {!hiddenItems.includes('TextFormatting') && <TextFormatting />}
            {!hiddenItems.includes('FillAndBorderFormatting') && <FillAndBorderFormatting />}
            {!hiddenItems.includes('AlignmentFormatting') && <AlignmentFormatting />}
            {!hiddenItems.includes('Clear') && <Clear />}
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
                  {hiddenItems.includes('NumberFormatting') && <NumberFormatting />}
                  {hiddenItems.includes('DateFormatting') && <DateFormatting />}
                  {hiddenItems.includes('TextFormatting') && <TextFormatting />}
                  {hiddenItems.includes('FillAndBorderFormatting') && <FillAndBorderFormatting />}
                  {hiddenItems.includes('AlignmentFormatting') && <AlignmentFormatting />}
                  {hiddenItems.includes('Clear') && <Clear />}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
    </>
  );
};
