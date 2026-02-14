import { apiClient } from '@/shared/api/apiClient';
import { atom, getDefaultStore } from 'jotai';

export interface BillingConfig {
  proAiAllowance: number;
  businessAiAllowance: number;
  isLoaded: boolean;
}

const defaultState: BillingConfig = {
  proAiAllowance: 20,
  businessAiAllowance: 40,
  isLoaded: false,
};

export const billingConfigAtom = atom<BillingConfig>(defaultState);

let fetchPromise: Promise<void> | null = null;

/**
 * Fetch billing config from API and populate the atom.
 * This is idempotent - multiple calls will reuse the same promise.
 */
export const fetchBillingConfig = async (): Promise<void> => {
  const store = getDefaultStore();
  const current = store.get(billingConfigAtom);

  if (current.isLoaded) {
    return;
  }

  if (fetchPromise) {
    return fetchPromise;
  }

  fetchPromise = apiClient.billing
    .config()
    .then((config) => {
      store.set(billingConfigAtom, {
        proAiAllowance: config.proAiAllowance,
        businessAiAllowance: config.businessAiAllowance,
        isLoaded: true,
      });
    })
    .catch((error) => {
      console.error('Failed to fetch billing config:', error);
      fetchPromise = null;
    });

  return fetchPromise;
};
