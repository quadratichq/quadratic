import { SetValue } from '@/shared/hooks/useLocalStorage';

// panel percent minimum and maximum values
export const MIN_PANEL_HEIGHT_PERCENT = 20;
export const MAX_PANEL_HEIGHT_PERCENT = 80;

// Adjust percentages of panel to match the new value.
export function adjustPercentages(
  panelHeightPercentages: number[],
  setPanelHeightPercentages: SetValue<number[]>,
  index: number,
  newValue: number
) {
  // clamp percentage values to (MIN, MAX)
  let clampedNewValue = Math.max(MIN_PANEL_HEIGHT_PERCENT, Math.min(MAX_PANEL_HEIGHT_PERCENT, newValue));

  // if there are only two panels, then it's easy
  if (panelHeightPercentages.length === 2) {
    if (index === 0) {
      setPanelHeightPercentages([clampedNewValue, 100 - clampedNewValue]);
    } else {
      setPanelHeightPercentages([100 - clampedNewValue, clampedNewValue]);
    }
    return;
  }

  // Otherwise, we need to adjust panels to fit the new value.
  let current = panelHeightPercentages[index];

  // return if clamped value is the same as the current value
  if (clampedNewValue === current) return;

  // This holds the changed heights
  const newHeights = [...panelHeightPercentages];

  // If we want to grow the first panel, then we need the next panels to shrink.
  if (clampedNewValue > current && index === 0) {
    const desiredGrowth = clampedNewValue - current;
    let growth = desiredGrowth;
    let next = index + 1;
    while (next < panelHeightPercentages.length) {
      const possibleNewValue = newHeights[next] - growth;

      // Cannot grow next panel enough to fit the desired shrink. Grow as much
      // as possible and try the next next panel.
      if (possibleNewValue < MIN_PANEL_HEIGHT_PERCENT) {
        growth -= newHeights[next] - MIN_PANEL_HEIGHT_PERCENT;
        newHeights[next] = MIN_PANEL_HEIGHT_PERCENT;
      }

      // We can grow the next panel to fit the desired shrink. We're done.
      else {
        newHeights[next] = possibleNewValue;
        newHeights[index] = clampedNewValue;
        break;
      }
      next++;
    }
    // we ran out of space to grow the next panels, so we adjust the
    // current panel but whatever we were able to grow
    if (next === panelHeightPercentages.length) {
      newHeights[index] = current + desiredGrowth - growth;
    }
  }

  // if we want to shrink the last panel, then we need th previous panels to grow
  else if (clampedNewValue < current && index === panelHeightPercentages.length - 1) {
    const desiredShrink = current - clampedNewValue;
    let shrink = desiredShrink;
    let previous = index - 1;
    while (previous !== -1) {
      const possibleNewValue = newHeights[previous] + shrink;

      // Cannot shrink previous panel enough to fit the desired growth. Shrink
      // as much as possible and try the next previous panel.
      if (possibleNewValue > MAX_PANEL_HEIGHT_PERCENT) {
        shrink -= MAX_PANEL_HEIGHT_PERCENT - newHeights[previous];
        newHeights[previous] = MAX_PANEL_HEIGHT_PERCENT;
      }

      // We can shrink the previous panel to fit the desired growth. We're done.
      else {
        newHeights[previous] = possibleNewValue;
        newHeights[index] = clampedNewValue;
        break;
      }
      previous--;
    }
    // we ran out of space to shrink the previous panels, so we adjust the
    // current panel but whatever we were able to shrink
    if (previous === -1) {
      newHeights[index] = current + desiredShrink - shrink;
    }
  }

  // If we're shrinking the panel, then we need the next panels to grow.
  else if (clampedNewValue < current) {
    const desiredGrowth = current - clampedNewValue;
    let growth = desiredGrowth;
    let next = index + 1;
    while (next < panelHeightPercentages.length) {
      const possibleNewValue = newHeights[next] + growth;

      // Cannot grow next panel enough to fit the desired shrink. Grow as much
      // as possible and try the next next panel.
      if (possibleNewValue > MAX_PANEL_HEIGHT_PERCENT) {
        growth -= MAX_PANEL_HEIGHT_PERCENT - newHeights[next];
        newHeights[next] = MAX_PANEL_HEIGHT_PERCENT;
      }

      // We can grow the next panel to fit the desired shrink. We're done.
      else {
        newHeights[next] = possibleNewValue;
        newHeights[index] = clampedNewValue;
        break;
      }
      next++;
    }
  }

  // If we're growing the panel, then we need the previous panels to shrink.
  else if (clampedNewValue > current) {
    const desiredShrink = clampedNewValue - current;
    let shrink = desiredShrink;
    let previous = index - 1;
    while (previous !== -1) {
      const possibleNewValue = newHeights[previous] - shrink;

      // Cannot shrink previous panel enough to fit the desired growth. Shrink
      // as much as possible and try the next previous panel.
      if (possibleNewValue < MIN_PANEL_HEIGHT_PERCENT) {
        shrink -= newHeights[previous] - MIN_PANEL_HEIGHT_PERCENT;
        newHeights[previous] = MIN_PANEL_HEIGHT_PERCENT;
      }

      // We can shrink the previous panel to fit the desired growth. We're done.
      else {
        newHeights[previous] = possibleNewValue;
        newHeights[index] = clampedNewValue;
        break;
      }
      previous--;
    }
    // we ran out of space to shrink the previous panels, so we adjust the
    // current panel but whatever we were able to shrink
    if (previous === -1) {
      newHeights[index] = current + desiredShrink - shrink;
    }
  }

  if (newHeights[index] !== panelHeightPercentages[index]) {
    setPanelHeightPercentages(newHeights);
  }
}
