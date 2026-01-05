import { codeEditorCodeCellAtom } from '@/app/atoms/codeEditorAtom';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { adjustPercentages } from '@/app/ui/menus/CodeEditor/panels/adjustPercentages';
import { getRightPanelsWidth } from '@/app/ui/menus/CodeEditor/panels/getRightPanelsWidth';
import type { SetValue } from '@/shared/hooks/useLocalStorage';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
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

  // Refs to track current values for use in event handlers (avoids stale closures)
  const editorWidthRef = useRef(editorWidth);
  const panelWidthRef = useRef(panelWidth);
  const panelPositionRef = useRef(panelPosition);

  // Keep refs in sync with state (useLayoutEffect ensures sync before any other effects/callbacks)
  useLayoutEffect(() => {
    editorWidthRef.current = editorWidth;
    panelWidthRef.current = panelWidth;
    panelPositionRef.current = panelPosition;
  }, [editorWidth, panelWidth, panelPosition]);

  // attempts to adjust percentages of panel to match the new value
  const adjustPanelPercentage = useCallback(
    (index: number, newValue: number) => {
      adjustPercentages(panelHeightPercentages, setPanelHeightPercentages, index, newValue);
    },
    [panelHeightPercentages, setPanelHeightPercentages]
  );

  // Whenever we change the position of the panel to be left-to-right, make sure
  // there's enough width for the editor and the panel.
  // Only depends on panelPosition to avoid loops when setting width values.
  useEffect(() => {
    if (panelPosition === 'left') {
      // Use setTimeout to ensure DOM has updated before querying element positions
      const timeoutId = setTimeout(() => {
        const rightPanelsWidth = getRightPanelsWidth();
        const availableWidth = window.innerWidth - MIN_WIDTH_VISIBLE_GRID - rightPanelsWidth;
        // Read current values from refs to avoid stale closures
        const currentEditorWidth = editorWidthRef.current;
        const currentPanelWidth = panelWidthRef.current;
        if (currentEditorWidth + currentPanelWidth > availableWidth) {
          setPanelWidth(MIN_WIDTH_PANEL);
          setEditorWidth(availableWidth - MIN_WIDTH_PANEL);
        }
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [panelPosition, setEditorWidth, setPanelWidth]);

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

      // Debounce: wait for resize events to settle, then read fresh values from refs
      debounceTimeoutId = setTimeout(() => {
        // Read fresh window width at execution time (not from stale event)
        const width = window.innerWidth;

        if (width < MAX_WIDTH) return;

        // Read current values from refs (always up-to-date, avoids stale closures)
        const currentEditorWidth = editorWidthRef.current;
        const currentPanelWidth = panelWidthRef.current;
        const currentPanelPosition = panelPositionRef.current;

        // DOM should be stable now after debounce delay
        const rightPanelsWidth = getRightPanelsWidth();
        const availableWidth = width - MIN_WIDTH_VISIBLE_GRID - rightPanelsWidth;

        if (currentPanelPosition === 'left' && currentPanelWidth + currentEditorWidth > availableWidth) {
          const totalOldWidth = currentEditorWidth + currentPanelWidth;

          setEditorWidth(() => {
            const editorPercentage = currentEditorWidth / totalOldWidth;
            return availableWidth * editorPercentage;
          });

          setPanelWidth(() => {
            const panelPercentage = currentPanelWidth / totalOldWidth;
            return availableWidth * panelPercentage;
          });
        } else if (currentPanelPosition === 'bottom' && currentEditorWidth > availableWidth) {
          const totalOldWidth = currentEditorWidth;
          setEditorWidth(() => {
            const editorPercentage = currentEditorWidth / totalOldWidth;
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
  }, [setBottomHidden, setEditorWidth, setPanelWidth]);

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
