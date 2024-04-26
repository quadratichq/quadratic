import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { useCallback } from 'react';

export const InlineEditor = () => {
  const ref = useCallback((div: HTMLDivElement) => {
    inlineEditorHandler.attach(div);
  }, []);

  return <div id="cell-edit" ref={ref} style={{ position: 'absolute' }}></div>;
};
