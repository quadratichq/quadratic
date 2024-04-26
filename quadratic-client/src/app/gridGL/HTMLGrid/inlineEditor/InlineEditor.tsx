import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { Button } from '@/shared/shadcn/ui/button';
import { useCallback } from 'react';

export const InlineEditor = () => {
  const ref = useCallback((div: HTMLDivElement) => {
    inlineEditorHandler.attach(div);
  }, []);

  // Note: <Button>'s event handler is defined in inlineEditorHandler.

  return (
    <div ref={ref} style={{ position: 'absolute', display: 'flex', pointerEvents: 'auto', alignItems: 'center' }}>
      <div id="cell-edit"></div>
      <Button
        style={{
          marginLeft: '8px',
          padding: '0 3px',
          display: 'none',
        }}
      >
        &#9654;
      </Button>
    </div>
  );
};
