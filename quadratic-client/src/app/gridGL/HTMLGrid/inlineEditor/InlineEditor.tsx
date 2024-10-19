//! This is the React component that holds the inline editor and the (optional)
//! button that opens the full-sized code editor. All functionality is defined
//! in inlineEditorHandler.ts.

import { inlineEditorAtom } from '@/app/atoms/inlineEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { CURSOR_THICKNESS } from '@/app/gridGL/UI/Cursor';
import { colors } from '@/app/theme/colors';
import { SidebarRightIcon } from '@/app/ui/icons';
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
    height = Math.max(height, sheets.sheet.getCellOffsets(inlineShowing.x, inlineShowing.y).height);
  }

  return (
    <div
      ref={ref}
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
              alignItems: 'center',
              borderRadius: '0',
              padding: '0',
              height: `${height}px`,
              right: '-24px',
              backgroundColor: colors.languageFormula,
            }}
            onClick={(e) => {
              e.stopPropagation();
              inlineEditorHandler.openCodeEditor();
            }}
          >
            <SidebarRightIcon style={{ color: 'white', width: '20px', height: '20px' }} />
          </Button>
        </TooltipPopover>
      ) : null}
    </div>
  );
};
