import { billingConfigAtom, fetchBillingConfig } from '@/shared/atom/billingConfigAtom';
import { CheckIcon } from '@/shared/components/Icons';
import { Badge } from '@/shared/shadcn/ui/badge';
import { useAtomValue } from 'jotai';
import { type ReactNode, useEffect } from 'react';

export const ProPlan = ({
  children,
  showCurrentPlanBadge,
  className,
  proAiAllowance,
}: {
  className?: string;
  children?: ReactNode;
  showCurrentPlanBadge?: boolean;
  /** AI allowance from API (e.g. from billing config). When omitted, falls back to billingConfigAtom. */
  proAiAllowance?: number;
}) => {
  const billingConfig = useAtomValue(billingConfigAtom);
  const displayAllowance = proAiAllowance ?? billingConfig.proAiAllowance;

  useEffect(() => {
    fetchBillingConfig();
  }, []);

  return (
    <div className={`${className} flex h-full flex-col`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Pro plan</h3>
        {showCurrentPlanBadge && <Badge>Current plan</Badge>}
      </div>
      <div className="flex flex-grow flex-col gap-2 text-sm">
        <div className="flex items-center justify-between">
          <span>Team members</span>
          <span className="text-sm font-medium">$20/user/month</span>
        </div>
        <div className="flex items-center justify-between">
          <span>AI usage</span>
          <span className="text-sm font-medium">${displayAllowance}/user/month allowance</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Connections</span>
          <span className="text-right text-sm font-medium">Unlimited</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Files</span>
          <span className="text-right text-sm font-medium">Unlimited</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Additional AI models</span>
          <span className="flex items-center">
            <CheckIcon />
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Additional privacy controls</span>
          <span className="flex items-center">
            <CheckIcon />
          </span>
        </div>
      </div>

      <div className="mt-auto">{children}</div>
    </div>
  );
};
