import { useCallback, useEffect, useRef } from 'react';
import { useRecoilState } from 'recoil';
import { atom } from 'recoil';
import { parseRangesFromText, parseRangeCoordinates, type RangeCoordinates } from '../utils/rangeParser';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { JsCellsAccessed, CellRefRange } from '@/app/quadratic-core-types';

export interface HighlightedRange {
  id: string;
  range: string;
  coordinates: RangeCoordinates;
  sheetName?: string;
  color: string;
  messageId?: string;
}

// Atom to store currently highlighted ranges
const rangeHighlightsAtom = atom<HighlightedRange[]>({
  key: 'rangeHighlightsAtom',
  default: [],
});

// Convert A1 range string to JsCellsAccessed format using coordinates
const convertA1RangeToJsCellsAccessed = (
  range: string,
  sheetId?: string,
  coordinates?: RangeCoordinates
): JsCellsAccessed | null => {
  try {
    // Default to current sheet if no sheet specified
    const targetSheetId = sheetId || sheets.current;

    // If we already have coordinates, use them directly
    if (coordinates) {
      const cellRefRanges: CellRefRange[] = [
        {
          range: {
            start: {
              col: { coord: BigInt(coordinates.startCol), is_absolute: false },
              row: { coord: BigInt(coordinates.startRow), is_absolute: false },
            },
            end: {
              col: { coord: BigInt(coordinates.endCol), is_absolute: false },
              row: {
                coord: BigInt(coordinates.endRow === Infinity ? 1048576 : coordinates.endRow),
                is_absolute: false,
              },
            },
          },
        },
      ];

      return {
        sheetId: targetSheetId,
        ranges: cellRefRanges,
      };
    }

    // If no coordinates provided, parse the range string
    const parsedCoords = parseRangeCoordinates(range);
    if (!parsedCoords) {
      return null;
    }

    return convertA1RangeToJsCellsAccessed(range, targetSheetId, parsedCoords);
  } catch (error) {
    console.warn('Failed to convert A1 range to JsCellsAccessed:', range, error);
    return null;
  }
};

export function useRangeHighlights() {
  const [highlights, setHighlights] = useRecoilState(rangeHighlightsAtom);
  const colorIndexRef = useRef(0);

  // Add highlights from a text message
  const addHighlightsFromText = useCallback(
    (text: string, messageId?: string) => {
      const parsedRanges = parseRangesFromText(text);
      const newHighlights: HighlightedRange[] = [];
      const cellsAccessedData: JsCellsAccessed[] = [];

      for (const parsedRange of parsedRanges) {
        const coordinates = parseRangeCoordinates(parsedRange.range);
        if (coordinates) {
          const highlight: HighlightedRange = {
            id: `${messageId || 'msg'}-${parsedRange.startIndex}-${Date.now()}`,
            range: parsedRange.range,
            coordinates,
            sheetName: parsedRange.sheetName,
            color: '', // Color will be handled by pixi system
            messageId,
          };

          newHighlights.push(highlight);

          // Convert to JsCellsAccessed format for pixi highlighting
          const cellsAccessed = convertA1RangeToJsCellsAccessed(parsedRange.range, parsedRange.sheetName, coordinates);
          if (cellsAccessed) {
            cellsAccessedData.push(cellsAccessed);
          }
        }
      }

      if (newHighlights.length > 0) {
        setHighlights((prev) => [...prev, ...newHighlights]);

        // Apply actual cell highlighting to the sheet
        if (cellsAccessedData.length > 0) {
          pixiApp.cellHighlights.fromCellsAccessed(cellsAccessedData, false);
        }
      }

      return newHighlights;
    },
    [setHighlights]
  );

  // Remove highlights by message ID
  const removeHighlightsByMessageId = useCallback(
    (messageId: string) => {
      setHighlights((prev) => {
        const filtered = prev.filter((h) => h.messageId !== messageId);

        // Reapply highlights for remaining ranges
        const remainingCellsAccessed: JsCellsAccessed[] = [];
        for (const highlight of filtered) {
          const cellsAccessed = convertA1RangeToJsCellsAccessed(
            highlight.range,
            highlight.sheetName,
            highlight.coordinates
          );
          if (cellsAccessed) {
            remainingCellsAccessed.push(cellsAccessed);
          }
        }

        // Update pixi highlights
        if (remainingCellsAccessed.length > 0) {
          pixiApp.cellHighlights.fromCellsAccessed(remainingCellsAccessed, false);
        } else {
          pixiApp.cellHighlights.clear();
        }

        return filtered;
      });
    },
    [setHighlights]
  );

  // Remove specific highlight by ID
  const removeHighlight = useCallback(
    (highlightId: string) => {
      setHighlights((prev) => prev.filter((h) => h.id !== highlightId));
    },
    [setHighlights]
  );

  // Effect to apply all current highlights to the sheet
  useEffect(() => {
    const allCellsAccessed: JsCellsAccessed[] = [];

    for (const highlight of highlights) {
      const cellsAccessed = convertA1RangeToJsCellsAccessed(
        highlight.range,
        highlight.sheetName,
        highlight.coordinates
      );
      if (cellsAccessed) {
        allCellsAccessed.push(cellsAccessed);
      }
    }

    // Apply all highlights to the sheet
    if (allCellsAccessed.length > 0) {
      pixiApp.cellHighlights.fromCellsAccessed(allCellsAccessed, false);
    } else {
      pixiApp.cellHighlights.clear();
    }
  }, [highlights]);

  // Clear all highlights
  const clearAllHighlights = useCallback(() => {
    setHighlights([]);
    colorIndexRef.current = 0;
    // Clear pixi cell highlights as well
    pixiApp.cellHighlights.clear();
  }, [setHighlights]);

  // Get highlights for current sheet
  const getHighlightsForSheet = useCallback(
    (sheetName?: string) => {
      return highlights.filter((h) => !h.sheetName || h.sheetName === sheetName);
    },
    [highlights]
  );

  return {
    highlights,
    addHighlightsFromText,
    removeHighlightsByMessageId,
    removeHighlight,
    clearAllHighlights,
    getHighlightsForSheet,
  };
}
