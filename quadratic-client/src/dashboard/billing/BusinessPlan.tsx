import { billingConfigAtom, fetchBillingConfig } from '@/shared/atom/billingConfigAtom';
import { CheckIcon } from '@/shared/components/Icons';
import { Badge } from '@/shared/shadcn/ui/badge';
import { useAtomValue } from 'jotai';
import { type ReactNode, useEffect } from 'react';

export const BusinessPlan = ({
  children,
  showCurrentPlanBadge,
  className,
}: {
  className?: string;
  children?: ReactNode;
  showCurrentPlanBadge?: boolean;
}) => {
  const billingConfig = useAtomValue(billingConfigAtom);

  useEffect(() => {
    fetchBillingConfig();
  }, []);

  return (
    <div className={`${className} flex h-full flex-col`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Business plan</h3>
        {showCurrentPlanBadge && <Badge>Current plan</Badge>}
      </div>
      <div className="flex flex-grow flex-col gap-2 text-sm">
        <div className="flex items-center justify-between">
          <span>Team members</span>
          <span className="text-sm font-medium">$40/user/month</span>
        </div>
        <div className="flex items-center justify-between">
          <span>AI usage</span>
          <span className="text-sm font-medium">${billingConfig.businessAiAllowance}/user/month allowance</span>
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
        <div className="flex items-center justify-between">
          <span>Budget management</span>
          <span className="flex items-center">
            <CheckIcon />
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>On-demand usage available for overages</span>
          <span className="flex items-center">
            <CheckIcon />
          </span>
        </div>
      </div>

      <div className="mt-auto">{children}</div>
    </div>
  );
};
