//! This is the React component that holds the inline editor and the (optional)
//! button that opens the full-sized code editor. All functionality is defined
//! in inlineEditorHandler.ts.

import { inlineEditorAtom } from '@/app/atoms/inlineEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { CURSOR_THICKNESS } from '@/app/gridGL/UI/Cursor';
import { convertTintToHex, getCSSVariableTint } from '@/app/helpers/convertColor';
import { DockToLeftIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import './inlineEditorStyles.scss';

export const InlineEditor = () => {
  const ref = useCallback((div: HTMLDivElement) => {
    if (div) {
      inlineEditorHandler.attach(div);
    } else {
      inlineEditorHandler.detach();
    }
  }, []);

  let { visible, formula, left, top, height } = useRecoilValue(inlineEditorAtom);
  height += CURSOR_THICKNESS * 1.5;
  const inlineShowing = inlineEditorHandler.getShowing();
  if (inlineShowing) {
    // Check if the cell is part of a merged cell and get the full merged cell rect
    const mergeRect = sheets.sheet.getMergeCellRect(inlineShowing.x, inlineShowing.y);
    let cellHeight: number;
    if (mergeRect) {
      const cellBounds = sheets.sheet.getScreenRectangle(
        Number(mergeRect.min.x),
        Number(mergeRect.min.y),
        Number(mergeRect.max.x) - Number(mergeRect.min.x) + 1,
        Number(mergeRect.max.y) - Number(mergeRect.min.y) + 1
      );
      cellHeight = cellBounds.height;
    } else {
      cellHeight = sheets.sheet.getCellOffsets(inlineShowing.x, inlineShowing.y).height;
    }
    height = Math.max(height, cellHeight);
  }

  return (
    <div
      ref={ref}
      className="dark-mode-hack"
      style={{
        position: 'absolute',
        display: 'flex',
        alignItems: 'center',
        visibility: visible ? 'visible' : 'hidden',
        pointerEvents: visible ? 'auto' : 'none',
        left: `${left}px`,
        top: `${top}px`,
      }}
    >
      <div id="cell-edit"></div>

      {visible && formula ? (
        <TooltipPopover label="Open Formula in multi-line code editor">
          <Button
            variant="ghost"
            style={{
              boxSizing: 'content-box',
              position: 'absolute',
              display: 'flex',
              alignItems: 'flex-start',
              borderRadius: '0',
              padding: '0',
              height: `${height}px`,
              right: '-24px',
              backgroundColor: convertTintToHex(getCSSVariableTint('primary')),
            }}
            onClick={(e) => {
              e.stopPropagation();
              inlineEditorHandler.openCodeEditor();
            }}
          >
            <DockToLeftIcon style={{ color: 'white', width: '20px', height: '20px' }} />
          </Button>
        </TooltipPopover>
      ) : null}
    </div>
  );
};
