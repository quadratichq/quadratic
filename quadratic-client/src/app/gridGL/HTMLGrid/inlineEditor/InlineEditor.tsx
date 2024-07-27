//! This is the React component that holds the inline editor and the (optional)
//! button that opens the full-sized code editor. All functionality is defined
//! in inlineEditorHandler.ts.

import { SubtitlesOutlined } from '@mui/icons-material';
import { Tooltip } from '@mui/material';
import { useCallback } from 'react';

import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { colors } from '@/app/theme/colors';
import { Button } from '@/shared/shadcn/ui/button';

export const InlineEditor = () => {
  const ref = useCallback((div: HTMLDivElement) => {
    inlineEditorHandler.attach(div);
  }, []);

  // Note: I switched to using material's Tooltip because radix-ui's Tooltip did
  // not keep position during viewport changes. Even forcing a remount did not
  // fix its positioning problem. There's probably a workaround, but it was too
  // much work.

  return (
    <div ref={ref} style={{ position: 'absolute', display: 'flex', pointerEvents: 'auto', alignItems: 'center' }}>
      <div id="cell-edit"></div>

      <Tooltip title="Open Formula in multi-line code editor">
        <Button
          variant="ghost"
          style={{
            position: 'absolute',
            alignItems: 'center',
            borderRadius: '0',
            padding: '0',
            marginTop: '-0.23px',
            width: '23px',
            height: '23.23px',
            right: '-23px',
            backgroundColor: colors.languageFormula,
          }}
        >
          <SubtitlesOutlined sx={{ width: '18px', height: '18px', color: 'white' }} />
        </Button>
      </Tooltip>
    </div>
  );
};
