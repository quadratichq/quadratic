import { events } from '@/app/events/events';
import { apiClient } from '@/shared/api/apiClient';
import confetti from 'canvas-confetti';
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';

type BonusPrompt = ApiTypes['/v0/user/tutorial-bonus-prompts.GET.response']['bonusPrompts'][number];

const bonusPromptsDataAtom = atom<BonusPrompt[] | null>(null);

// Atom to track if bonus prompts have been loaded from the API
export const bonusPromptsLoadedAtom = atom((get) => {
  const data = get(bonusPromptsDataAtom);
  return data !== null;
});

// Async atom that fetches bonus prompts from the API and updates the cache
const fetchBonusPromptsAtom = atom(null, async (get, set) => {
  const cached = get(bonusPromptsDataAtom);
  if (cached !== null) {
    return cached;
  }
  const response = await apiClient.user.tutorialBonusPrompts.get();
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

// confetti celebration for checklist items
const celebrateChecklistItem = (category: string) => {
  const element = document.getElementById(`onboarding-checklist-item-${category}`);
  if (!element) return;

  const rect = element.getBoundingClientRect();
  const x = (rect.left + rect.width / 2) / window.innerWidth;
  const y = rect.bottom / window.innerHeight;

  confetti({
    particleCount: 100,
    spread: 70,
    origin: { x, y },
    zIndex: 10000,
  });
};

// Write-only atom for claiming bonus prompts (calls API and updates state)
export const claimBonusPromptAtom = atom(null, async (get, set, category: string) => {
  try {
    const result = await apiClient.user.tutorialBonusPrompts.claim({ category });
    set(bonusPromptsAtom, { type: 'claim', category });
    events.emit('aiAnalystMessagesLeftRefresh');
    celebrateChecklistItem(category);
    return result;
  } catch (error) {
    console.error('Failed to claim bonus prompt:', error);
    throw error;
  }
});

// Atom with localStorage persistence for checklist to show automatically on startup
const checklistShowOnStartupAtom = atomWithStorage('checklistShowOnStartup', true);

// Session atom to track if user manually opened the checklist (resets on page reload)
const manuallyOpenedAtom = atom(false);

// Helper to check if there are unchecked items
const hasUncheckedItems = (bonusPrompts: BonusPrompt[] | null): boolean => {
  if (!bonusPrompts || bonusPrompts.length === 0) {
    return false;
  }
  return bonusPrompts.some((prompt) => !prompt.received && prompt.active);
};

// Atom to control onboarding checklist visibility
export const onboardingChecklistAtom = atom(
  (get) => {
    // If manually opened, always show
    const manuallyOpened = get(manuallyOpenedAtom);
    if (manuallyOpened) {
      return true;
    }

    // Check localStorage value - if dismissed (false), don't show
    const shouldShowOnStartup = get(checklistShowOnStartupAtom);
    if (!shouldShowOnStartup) {
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
      set(checklistShowOnStartupAtom, false);
      // Clear manually opened flag
      set(manuallyOpenedAtom, false);
    } else if (action === 'open') {
      // Manually open and set localStorage to show on next startup
      set(checklistShowOnStartupAtom, true);
      set(manuallyOpenedAtom, true);
    }
  }
);
