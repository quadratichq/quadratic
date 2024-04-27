import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { Button } from '@/shared/shadcn/ui/button';
import { Tooltip, TooltipContent, TooltipProvider } from '@/shared/shadcn/ui/tooltip';
import { TooltipTrigger } from '@radix-ui/react-tooltip';
import { useCallback } from 'react';

export const InlineEditor = () => {
  const ref = useCallback((div: HTMLDivElement) => {
    inlineEditorHandler.attach(div);
  }, []);

  // Note: <Button>'s event handler is defined in inlineEditorHandler.

  return (
    <div ref={ref} style={{ position: 'absolute', display: 'flex', pointerEvents: 'auto', alignItems: 'center' }}>
      <div id="cell-edit"></div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              style={{
                marginLeft: '8px',
                padding: '0 3px',
                display: 'none',
              }}
            >
              &#9654;
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open Formula in full-sized code editor</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};
