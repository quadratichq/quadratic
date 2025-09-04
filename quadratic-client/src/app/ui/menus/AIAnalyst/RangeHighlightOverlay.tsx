import { memo, useEffect } from 'react';
import { useRangeHighlights } from './hooks/useRangeHighlights';

interface RangeHighlightOverlayProps {
  currentSheetName?: string;
}

export const RangeHighlightOverlay = memo(({ currentSheetName }: RangeHighlightOverlayProps) => {
  const { getHighlightsForSheet } = useRangeHighlights();
  const highlights = getHighlightsForSheet(currentSheetName);

  useEffect(() => {
    // For now, just log the highlights to show they're working
    // Later this can be integrated with the PixiJS rendering system
    if (highlights.length > 0) {
      console.log(
        'Range highlights active:',
        highlights.map((h) => h.range)
      );
    }
  }, [highlights]);

  // For now, render a simple visual indicator
  if (highlights.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        background: 'rgba(59, 130, 246, 0.9)',
        color: 'white',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 'bold',
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      {highlights.length} range{highlights.length !== 1 ? 's' : ''} highlighted
    </div>
  );
});
