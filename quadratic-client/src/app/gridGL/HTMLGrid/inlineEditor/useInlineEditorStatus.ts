import { useEffect, useState } from 'react';
import { inlineEditorEvents } from './inlineEditorEvents';

export const useInlineEditorStatus = (): boolean => {
  // need to track whether inlineEditor is open
  const [inlineEditorOpen, setInlineEditorOpen] = useState(false);
  useEffect(() => {
    const changeStatus = (status: boolean) => setInlineEditorOpen(status);
    inlineEditorEvents.on('status', changeStatus);
    return () => {
      inlineEditorEvents.off('status', changeStatus);
    };
  }, []);

  return inlineEditorOpen;
};
