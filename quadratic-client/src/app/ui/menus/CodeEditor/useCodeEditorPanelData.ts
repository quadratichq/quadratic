import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

export type PanelPosition = 'bottom' | 'left';

export interface CodeEditorPanelData {
  editorWidth: number;
  setEditorWidth: (value: number | ((old: number) => number)) => void;
  editorHeightPercentage: number;
  setEditorHeightPercentage: (value: number | ((old: number) => number)) => void;
  panelWidth: number;
  setPanelWidth: (value: number | ((old: number) => number)) => void;
  panelHeightPercentage: number;
  setPanelHeightPercentage: (value: number) => void;
  panelHeightPercentages: number[];
  setPanelHeightPercentages: Dispatch<SetStateAction<number[]>>;
  panelPosition: PanelPosition;
  setPanelPosition: (value: PanelPosition | ((old: PanelPosition) => PanelPosition)) => void;
}

export const MIN_WIDTH_PANEL = 300;

// this is computed based on the minimum size of the sheet bar with `Sheet 1` as
// the only visible sheet. TODO: this should be computed dynamically so we can
// take into account browser font sizes and other factors
export const MIN_WIDTH_VISIBLE_GRID = 215;

// maximum width for showing the editor
const MAX_WIDTH = 1024;

export const useCodeEditorPanelData = (): CodeEditorPanelData => {
  const { mode } = useRecoilValue(editorInteractionStateAtom);
  const [editorWidth, setEditorWidth] = useLocalStorage<number>(
    'codeEditorWidth',
    window.innerWidth * 0.35 // default to 35% of the window width
  );
  const [editorHeightPercentage, setEditorHeightPercentage] = useLocalStorage<number>('codeEditorHeightPercentage', 75);
  const [panelWidth, setPanelWidth] = useLocalStorage('codeEditorPanelWidth', MIN_WIDTH_PANEL);
  const [panelHeightPercentage, setPanelHeightPercentage] = useLocalStorage<number>(
    'codeEditorPanelHeightPercentage',
    50
  );
  const [panelHeightPercentages, setPanelHeightPercentages] = useState<number[]>([33, 33]);
  const [panelPosition, setPanelPosition] = useLocalStorage<PanelPosition>('codeEditorPanelPosition', 'bottom');

  // When we change the number of panels, reset the heights
  useEffect(() => {
    if (typeof mode === 'object') {
      setPanelHeightPercentages([34, 33, 33]);
    } else {
      setPanelHeightPercentages([50, 50]);
    }
  }, [mode, setPanelHeightPercentages]);

  // Whenever we change the position of the panel to be left-to-right, make sure
  // there's enough width for the editor and the panel
  useEffect(() => {
    if (panelPosition === 'left') {
      if (editorWidth + panelWidth > window.innerWidth - MIN_WIDTH_VISIBLE_GRID) {
        setPanelWidth(MIN_WIDTH_PANEL);
        setEditorWidth(window.innerWidth - MIN_WIDTH_PANEL - MIN_WIDTH_VISIBLE_GRID);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelPosition]);

  // When the window resizes, recalculate the appropriate proportions for
  // the editor and the panel
  useEffect(() => {
    const handleResize = (event: any) => {
      const width = event.target.innerWidth;

      if (width < MAX_WIDTH) return;

      const availableWidth = width - MIN_WIDTH_VISIBLE_GRID;
      if (panelPosition === 'left' && panelWidth + editorWidth > availableWidth) {
        const totalOldWidth = editorWidth + panelWidth;

        setEditorWidth((oldEditorWidth) => {
          const editorPercentage = oldEditorWidth / totalOldWidth;
          return availableWidth * editorPercentage;
        });

        setPanelWidth((oldPanelWidth) => {
          const panelPercentage = oldPanelWidth / totalOldWidth;
          return availableWidth * panelPercentage;
        });
      } else if (panelPosition === 'bottom' && editorWidth > availableWidth) {
        const totalOldWidth = editorWidth;
        setEditorWidth((oldEditorWidth) => {
          const editorPercentage = oldEditorWidth / totalOldWidth;
          return availableWidth * editorPercentage;
        });
      }
    };

    window.addEventListener('resize', handleResize, true);
    return () => {
      window.removeEventListener('resize', handleResize, true);
    };
  }, [editorWidth, panelPosition, panelWidth, setEditorWidth, setPanelWidth]);

  return {
    editorWidth,
    setEditorWidth,
    editorHeightPercentage,
    setEditorHeightPercentage,
    panelWidth,
    setPanelWidth,
    panelHeightPercentage,
    setPanelHeightPercentage,
    panelHeightPercentages,
    setPanelHeightPercentages,
    panelPosition,
    setPanelPosition,
  };
};
