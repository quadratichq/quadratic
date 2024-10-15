//! This is the React component that holds the inline editor and the (optional)
//! button that opens the full-sized code editor. All functionality is defined
//! in inlineEditorHandler.ts.

import { inlineEditorAtom } from '@/app/atoms/inlineEditorAtom';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { colors } from '@/app/theme/colors';
import { Button } from '@/shared/shadcn/ui/button';
import { SubtitlesOutlined } from '@mui/icons-material';
import { Tooltip } from '@mui/material';
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

  // Note: I switched to using material's Tooltip because radix-ui's Tooltip did
  // not keep position during viewport changes. Even forcing a remount did not
  // fix its positioning problem. There's probably a workaround, but it was too
  // much work.

  const { visible, formula, left, top, insertCellRef } = useRecoilValue(inlineEditorAtom);

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
        <Tooltip title="Open Formula in multi-line code editor">
          <Button
            variant="ghost"
            style={{
              position: 'absolute',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '0',
              padding: '0',
              marginTop: '-0.23px',
              width: '23px',
              height: '23.23px',
              right: '-24px',
              backgroundColor: colors.languageFormula,
            }}
            onClick={(e) => inlineEditorHandler.openCodeEditor(e)}
          >
            <SubtitlesOutlined sx={{ width: '18px', height: '18px', color: insertCellRef ? 'white' : 'black' }} />
          </Button>
        </Tooltip>
      ) : null}
    </div>
  );
};
