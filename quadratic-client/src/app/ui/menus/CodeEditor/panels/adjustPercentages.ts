import { SetValue } from '@/shared/hooks/useLocalStorage';

// panel percent minimum and maximum values
const MIN_HEIGHT_PERCENT = 20;
const MAX_HEIGHT_PERCENT = 80;

// attempts to adjust percentages of panel to match the new value
export function adjustPercentages(
  panelHeightPercentages: number[],
  setPanelHeightPercentages: SetValue<number[]>,
  index: number,
  newValue: number
) {
  // clamp percentage values to (MIN, MAX)
  const value = Math.max(MIN_HEIGHT_PERCENT, Math.min(MAX_HEIGHT_PERCENT, newValue));
  let diff = newValue - value;
  if (diff === 0) return;

  const newHeights = [...panelHeightPercentages];

  // we're growing
  if (diff > 0) {
    let next = index + 1;
    while (next !== newHeights.length) {
      const adjusted = newHeights[next] - diff;
      if (adjusted < MIN_HEIGHT_PERCENT) {
        diff = MIN_HEIGHT_PERCENT - adjusted;
        newHeights[next] = MIN_HEIGHT_PERCENT;
      } else {
        newHeights[next] = adjusted;
        break;
      }
      next++;
    }
  }

  // we're shrinking
  else if (diff < 0) {
    let previous = index - 1;
    while (previous !== -1) {
      const adjusted = newHeights[previous] - diff;
      if (adjusted > MAX_HEIGHT_PERCENT) {
        diff = adjusted - MAX_HEIGHT_PERCENT;
        newHeights[previous] = MAX_HEIGHT_PERCENT;
      } else {
        newHeights[previous] = adjusted;
        break;
      }
      previous++;
    }
  }

  if (newHeights[index] !== panelHeightPercentages[index]) {
    setPanelHeightPercentages(newHeights);
  }
}
