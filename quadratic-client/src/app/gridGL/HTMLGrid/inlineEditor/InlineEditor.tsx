//! This is the React component that holds the inline editor and the (optional)
//! button that opens the full-sized code editor. All functionality is defined
//! in inlineEditorHandler.ts.

import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { colors } from '@/app/theme/colors';
import { Button } from '@/shared/shadcn/ui/button';
import { Tooltip, TooltipContent, TooltipProvider } from '@/shared/shadcn/ui/tooltip';
import { SubtitlesOutlined } from '@mui/icons-material';
import { TooltipTrigger } from '@radix-ui/react-tooltip';
import { useCallback } from 'react';

export const InlineEditor = () => {
  const ref = useCallback((div: HTMLDivElement) => {
    inlineEditorHandler.attach(div);
  }, []);

  return (
    <div ref={ref} style={{ position: 'absolute', display: 'flex', pointerEvents: 'auto', alignItems: 'center' }}>
      <div id="cell-edit"></div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
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
                right: '-23px',
                backgroundColor: colors.languageFormula,
              }}
            >
              <SubtitlesOutlined sx={{ width: '18px', height: '18px', color: 'white' }} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open Formula in multi-line code editor</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};
