import type { Page } from '@playwright/test';

// This function clicks the "more formatting" icon in the formatting bar. This
// is only needed when there are hidden items based on screen width.
export const clickMoreFormattingIcon = async (page: Page) => {
  // The more formatting button only appears when hiddenItems.length > 0
  // (i.e., when the formatting bar is narrow enough that items need to overflow)

  // There are 2 more_vert icons - one in the measurement container (hidden) and one visible
  // We need to target only the visible one, not the one in #measurement-container
  const moreIcon = page.locator('#main .material-symbols-outlined:has-text("more_vert")');

  const count = await moreIcon.count();

  if (count === 0) {
    // Button is not visible, likely because all items fit on the bar
    return;
  }

  // Click the icon - the click will bubble up to the PopoverTrigger parent
  await moreIcon.click();
};
