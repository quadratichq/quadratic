import { codeEditorCodeCellAtom } from '@/app/atoms/codeEditorAtom';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { adjustPercentages } from '@/app/ui/menus/CodeEditor/panels/adjustPercentages';
import { getRightPanelsWidth } from '@/app/ui/menus/CodeEditor/panels/getRightPanelsWidth';
import type { SetValue } from '@/shared/hooks/useLocalStorage';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo } from 'react';
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
  setPanelHeightPercentages: SetValue<number[]>;
  panelPosition: PanelPosition;
  setPanelPosition: SetValue<PanelPosition>;
  adjustPanelPercentage: (index: number, newValue: number) => void;
  panelHidden: boolean[];
  setPanelHidden: Dispatch<SetStateAction<boolean[]>>;
  bottomHidden: boolean;
  setBottomHidden: Dispatch<SetStateAction<boolean>>;
}

export const MIN_WIDTH_PANEL = 300;

// this is computed based on the minimum size of the sheet bar with `Sheet 1` as
// the only visible sheet. TODO: this should be computed dynamically so we can
// take into account browser font sizes and other factors
export const MIN_WIDTH_VISIBLE_GRID = 215;

// maximum width for showing the editor
const MAX_WIDTH = 1024;

const HIDDEN_3 = [false, false, false];
const HIDDEN_2 = [false, false];
const HEIGHT_PERCENT_3 = [34, 33, 33];
const HEIGHT_PERCENT_2 = [50, 50];

const CODE_EDITOR_KEY = 'codeEditorWidth';
const CODE_EDITOR_PANEL_WIDTH_KEY = 'codeEditorPanelWidth';

export const useCodeEditorPanelData = (): CodeEditorPanelData => {
  const { language } = useRecoilValue(codeEditorCodeCellAtom);
  const [editorWidth, setEditorWidth] = useLocalStorage<number>(
    CODE_EDITOR_KEY,
    window.innerWidth * 0.35 // default to 35% of the window width
  );

  // this stores the height when editor is in vertical mode
  const [editorHeightPercentage, setEditorHeightPercentage] = useLocalStorage<number>(`codeEditorHeightPercentage`, 50);

  const type = getLanguage(language);

  // this stores the width/height when editor is in horizontal mode
  const [panelWidth, setPanelWidth] = useLocalStorage(CODE_EDITOR_PANEL_WIDTH_KEY, MIN_WIDTH_PANEL);
  const [panelHeightPercentage, setPanelHeightPercentage] = useLocalStorage<number>(
    `codeEditorPanelHeightPercentage-${type}`,
    50
  );
  const [panelHidden, setPanelHidden] = useLocalStorage<boolean[]>(
    `codeEditorPanelHidden-${type}`,
    type === 'Connection' ? HIDDEN_3 : HIDDEN_2
  );
  // stores the heights when in horizontal mode (Connection has 3 panels, others have 2)
  const [panelHeightPercentages, setPanelHeightPercentages] = useLocalStorage<number[]>(
    `codeEditorPanelHeightPercentages-${type}`,
    type === 'Connection' ? HEIGHT_PERCENT_3 : HEIGHT_PERCENT_2
  );
  const [panelPosition, setPanelPosition] = useLocalStorage<PanelPosition>('codeEditorPanelPosition', 'bottom');
  const [bottomHidden, setBottomHidden] = useLocalStorage('codeEditorPanelBottom', false);

  // attempts to adjust percentages of panel to match the new value
  const adjustPanelPercentage = useCallback(
    (index: number, newValue: number) => {
      adjustPercentages(panelHeightPercentages, setPanelHeightPercentages, index, newValue);
    },
    [panelHeightPercentages, setPanelHeightPercentages]
  );

  // Whenever we change the position of the panel to be left-to-right, make sure
  // there's enough width for the editor and the panel
  useEffect(() => {
    if (panelPosition === 'left') {
      // Use setTimeout to ensure DOM has updated before querying element positions
      const timeoutId = setTimeout(() => {
        const rightPanelsWidth = getRightPanelsWidth();
        const availableWidth = window.innerWidth - MIN_WIDTH_VISIBLE_GRID - rightPanelsWidth;
        if (editorWidth + panelWidth > availableWidth) {
          window.localStorage.setItem(CODE_EDITOR_PANEL_WIDTH_KEY, JSON.stringify(MIN_WIDTH_PANEL));
          window.localStorage.setItem(CODE_EDITOR_KEY, JSON.stringify(availableWidth - MIN_WIDTH_PANEL));
        }
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [editorWidth, panelPosition, panelWidth]);

  // When the window resizes, recalculate the appropriate proportions for
  // the editor and the panel. Debounced to wait for resize to settle and DOM to stabilize.
  useEffect(() => {
    let debounceTimeoutId: ReturnType<typeof setTimeout> | null = null;
    const DEBOUNCE_DELAY = 100; // ms to wait after last resize event

    const handleResize = () => {
      // Clear any pending debounced call
      if (debounceTimeoutId !== null) {
        clearTimeout(debounceTimeoutId);
      }

      // Debounce: wait for resize events to settle, then read fresh values
      debounceTimeoutId = setTimeout(() => {
        // Read fresh window width at execution time (not from stale event)
        const width = window.innerWidth;

        if (width < MAX_WIDTH) return;

        // DOM should be stable now after debounce delay
        const rightPanelsWidth = getRightPanelsWidth();
        const availableWidth = width - MIN_WIDTH_VISIBLE_GRID - rightPanelsWidth;

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
        setBottomHidden(false);
        debounceTimeoutId = null;
      }, DEBOUNCE_DELAY);
    };

    window.addEventListener('resize', handleResize, true);
    return () => {
      window.removeEventListener('resize', handleResize, true);
      if (debounceTimeoutId !== null) {
        clearTimeout(debounceTimeoutId);
      }
    };
  }, [editorWidth, panelPosition, panelWidth, setBottomHidden, setEditorWidth, setPanelWidth]);

  return useMemo(() => {
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
      adjustPanelPercentage,
      panelPosition,
      setPanelPosition,
      panelHidden,
      setPanelHidden,
      bottomHidden,
      setBottomHidden,
    };
  }, [
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
    adjustPanelPercentage,
    panelPosition,
    setPanelPosition,
    panelHidden,
    setPanelHidden,
    bottomHidden,
    setBottomHidden,
  ]);
};
