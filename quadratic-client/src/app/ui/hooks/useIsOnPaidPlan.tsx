import type { SetValue } from '@/shared/hooks/useLocalStorage';
import useLocalStorage from '@/shared/hooks/useLocalStorage';

const IS_ON_PAID_PLAN_LOCAL_STORAGE_KEY = 'isOnPaidPlan';
const PLAN_TYPE_LOCAL_STORAGE_KEY = 'planType';
const ALLOW_OVERAGE_PAYMENTS_LOCAL_STORAGE_KEY = 'allowOveragePayments';

export type PlanType = 'FREE' | 'PRO' | 'BUSINESS';

export const useIsOnPaidPlan = (): {
  isOnPaidPlan: boolean;
  setIsOnPaidPlan: SetValue<boolean>;
  planType: PlanType;
  setPlanType: SetValue<PlanType>;
  allowOveragePayments: boolean;
  setAllowOveragePayments: SetValue<boolean>;
} => {
  const [isOnPaidPlan, setIsOnPaidPlan] = useLocalStorage<boolean>(IS_ON_PAID_PLAN_LOCAL_STORAGE_KEY, false);
  const [planType, setPlanType] = useLocalStorage<PlanType>(PLAN_TYPE_LOCAL_STORAGE_KEY, 'FREE');
  const [allowOveragePayments, setAllowOveragePayments] = useLocalStorage<boolean>(
    ALLOW_OVERAGE_PAYMENTS_LOCAL_STORAGE_KEY,
    false
  );
  return { isOnPaidPlan, setIsOnPaidPlan, planType, setPlanType, allowOveragePayments, setAllowOveragePayments };
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
