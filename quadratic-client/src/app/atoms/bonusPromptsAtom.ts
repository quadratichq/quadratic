import { events } from '@/app/events/events';
import { apiClient } from '@/shared/api/apiClient';
import { atom } from 'jotai';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';

type BonusPrompt = ApiTypes['/v0/user/tutorialBonusPrompt.GET.response']['bonusPrompts'][number];

const bonusPromptsDataAtom = atom<BonusPrompt[] | null>(null);

// Async atom that fetches bonus prompts from the API and updates the cache
const fetchBonusPromptsAtom = atom(null, async (get, set) => {
  const cached = get(bonusPromptsDataAtom);
  if (cached !== null) {
    return cached;
  }
  const response = await apiClient.user.tutorialBonusPrompt.get();
  set(bonusPromptsDataAtom, response.bonusPrompts);
  return response.bonusPrompts;
});

// Main atom that combines read and write operations
export const bonusPromptsAtom = atom(
  (get) => {
    // Return cached data synchronously, trigger fetch if needed
    const cached = get(bonusPromptsDataAtom);
    return cached;
  },
  async (get, set, update: { type: 'claim'; category: string } | { type: 'refresh' } | { type: 'fetch' }) => {
    if (update.type === 'fetch') {
      // Trigger a fetch
      await set(fetchBonusPromptsAtom);
    } else if (update.type === 'refresh') {
      // Clear cache and refetch
      set(bonusPromptsDataAtom, null);
      await set(fetchBonusPromptsAtom);
    } else if (update.type === 'claim') {
      // Immediately update the cached state
      const currentPrompts = get(bonusPromptsDataAtom);
      if (currentPrompts) {
        const updatedPrompts = currentPrompts.map((prompt) =>
          prompt.category === update.category ? { ...prompt, received: true } : prompt
        );
        set(bonusPromptsDataAtom, updatedPrompts);
      }
    }
  }
);

// Write-only atom for claiming bonus prompts (calls API and updates state)
export const claimBonusPromptAtom = atom(null, async (get, set, category: string) => {
  try {
    const result = await apiClient.user.tutorialBonusPrompt.claim({ category });
    set(bonusPromptsAtom, { type: 'claim', category });
    events.emit('aiAnalystMessagesLeftRefresh');
    return result;
  } catch (error) {
    console.error('Failed to claim bonus prompt:', error);
    throw error;
  }
});

// LocalStorage key for automatic checklist display on startup
const CHECKLIST_SHOW_ON_STARTUP_KEY = 'checklistRefresh';

// Helper to get localStorage value (defaults to true if not set)
const getChecklistShowOnStartup = (): boolean => {
  const value = localStorage.getItem(CHECKLIST_SHOW_ON_STARTUP_KEY);
  return value === null ? true : value === 'true';
};

// Helper to check if there are unchecked items
const hasUncheckedItems = (bonusPrompts: BonusPrompt[] | null): boolean => {
  if (!bonusPrompts || bonusPrompts.length === 0) {
    return false;
  }
  return bonusPrompts.some((prompt) => !prompt.received && prompt.active);
};

// Private atom to track visibility state
// This combines manual open state and dismissed state
const checklistStateAtom = atom<{ manuallyOpened: boolean; dismissed: boolean }>({
  manuallyOpened: false,
  dismissed: !getChecklistShowOnStartup(), // Start as dismissed if localStorage says so
});

// Atom to control onboarding checklist visibility
export const onboardingChecklistAtom = atom(
  (get) => {
    const state = get(checklistStateAtom);

    // If manually opened, always show
    if (state.manuallyOpened) {
      return true;
    }

    // If dismissed, don't show
    if (state.dismissed) {
      return false;
    }

    // Check if there are unchecked items
    const bonusPrompts = get(bonusPromptsDataAtom);
    const hasUnchecked = hasUncheckedItems(bonusPrompts);

    return hasUnchecked;
  },
  (get, set, action: 'dismiss' | 'open') => {
    if (action === 'dismiss') {
      // Set localStorage to false to not show on startup
      localStorage.setItem(CHECKLIST_SHOW_ON_STARTUP_KEY, 'false');
      // Update state to mark as dismissed and not manually opened
      set(checklistStateAtom, { manuallyOpened: false, dismissed: true });
    } else if (action === 'open') {
      // Manually open and set localStorage to show on next startup
      localStorage.setItem(CHECKLIST_SHOW_ON_STARTUP_KEY, 'true');
      set(checklistStateAtom, { manuallyOpened: true, dismissed: false });
    }
  }
);
