import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { useCallback } from 'react';

export const InlineEditor = () => {
  const ref = useCallback((node: HTMLDivElement) => {
    if (node) {
      inlineEditorHandler.attach(node);
    }
  }, []);

  return (
    <div id="inline-editor" ref={ref} style={{ position: 'absolute', top: 0, left: 0 }}>
      HELLO THERE!!!
    </div>
  );
};
