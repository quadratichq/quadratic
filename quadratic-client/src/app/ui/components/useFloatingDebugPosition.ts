import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';

const SPACING = 8; // spacing between components in rem units (8 * 0.25rem = 2rem = 32px)
const BASE_BOTTOM = 12; // base bottom position in rem units

export function useFloatingDebugPosition(index: number): number {
  const { debugFlags } = useDebugFlags();

  // Check which components are visible
  const isFPSVisible = debugFlags.getFlag('debugShowFPS');
  const isTopLeftVisible = debugFlags.getFlag('debugShowTopLeftPosition');
  const isCoordinatesVisible = debugFlags.getFlag('debugShowCoordinates');

  // Count how many components below this one (lower index) are visible
  let visibleBelow = 0;
  if (index > 0 && isFPSVisible) visibleBelow++; // FPS is index 0
  if (index > 1 && isTopLeftVisible) visibleBelow++; // TopLeftPosition is index 1
  if (index > 2 && isCoordinatesVisible) visibleBelow++; // Coordinates is index 2

  // Calculate bottom position: base + (spacing * number of visible components below)
  // If no components below are visible, this component goes to the base position
  const bottomRem = BASE_BOTTOM + visibleBelow * SPACING;

  return bottomRem;
}
