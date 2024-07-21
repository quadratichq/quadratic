import { useState } from 'react';

export const useCodeEditorContainer = (): HTMLDivElement | null => {
  const initial: HTMLDivElement | null = document.querySelector('#code-editor-container');

  const [container, setContainer] = useState<HTMLDivElement | null>(initial);
  const fetchContainer = () => {
    let element: HTMLDivElement | null = document.querySelector('#code-editor-container');
    if (element) {
      setContainer(element);
    } else {
      setTimeout(fetchContainer, 0);
    }
  };
  if (!initial) {
    fetchContainer();
  }

  return container;
};
