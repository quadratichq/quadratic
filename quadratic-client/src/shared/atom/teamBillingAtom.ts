import { atom, getDefaultStore } from 'jotai';

export type PlanType = 'FREE' | 'PRO' | 'BUSINESS';

export interface TeamBillingState {
  isOnPaidPlan: boolean;
  planType: PlanType;
  allowOveragePayments: boolean;
  teamMonthlyBudgetLimit: number | null;
}

const defaultState: TeamBillingState = {
  isOnPaidPlan: false,
  planType: 'FREE',
  allowOveragePayments: false,
  teamMonthlyBudgetLimit: null,
};

const baseTeamBillingAtom = atom<TeamBillingState>(defaultState);

export const teamBillingAtom = atom(
  (get) => get(baseTeamBillingAtom),
  (get, set, updates: Partial<TeamBillingState>) => {
    set(baseTeamBillingAtom, { ...get(baseTeamBillingAtom), ...updates });
  }
);

/**
 * Update team billing state from any context (React or non-React).
 * Merges the provided updates with the current state.
 */
export const updateTeamBilling = (updates: Partial<TeamBillingState>) => {
  getDefaultStore().set(teamBillingAtom, updates);
};

/**
 * Set the allowOveragePayments value.
 * Convenience helper for updating just this field.
 */
export const setAllowOveragePayments = (value: boolean) => {
  updateTeamBilling({ allowOveragePayments: value });
};

/**
 * Set the teamMonthlyBudgetLimit value.
 * Convenience helper for updating just this field.
 */
export const setTeamMonthlyBudgetLimit = (value: number | null) => {
  updateTeamBilling({ teamMonthlyBudgetLimit: value });
};

/**
 * Set the full billing state.
 * Used when initializing from loader data.
 */
export const setTeamBilling = (state: TeamBillingState) => {
  getDefaultStore().set(baseTeamBillingAtom, state);
};

/**
 * Get the next plan to suggest when the user exceeds their AI limit.
 * - Free → Pro
 * - Pro → Business
 * - Business → Business+overage (if overage is not enabled)
 */
export const getNextPlanSuggestion = (
  planType: PlanType,
  allowOveragePayments: boolean
): { type: 'upgrade'; targetPlan: 'PRO' | 'BUSINESS' } | { type: 'enableOverage' } | null => {
  switch (planType) {
    case 'FREE':
      return { type: 'upgrade', targetPlan: 'PRO' };
    case 'PRO':
      return { type: 'upgrade', targetPlan: 'BUSINESS' };
    case 'BUSINESS':
      return allowOveragePayments ? null : { type: 'enableOverage' };
    default:
      return { type: 'upgrade', targetPlan: 'PRO' };
  }
};
