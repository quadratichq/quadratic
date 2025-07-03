import type { SetValue } from '@/shared/hooks/useLocalStorage';
import useLocalStorage from '@/shared/hooks/useLocalStorage';

const IS_ON_PAID_PLAN_LOCAL_STORAGE_KEY = 'isOnPaidPlan';

export const useIsOnPaidPlan = (): {
  isOnPaidPlan: boolean;
  setIsOnPaidPlan: SetValue<boolean>;
} => {
  const [isOnPaidPlan, setIsOnPaidPlan] = useLocalStorage<boolean>(IS_ON_PAID_PLAN_LOCAL_STORAGE_KEY, false);
  return { isOnPaidPlan, setIsOnPaidPlan };
};
