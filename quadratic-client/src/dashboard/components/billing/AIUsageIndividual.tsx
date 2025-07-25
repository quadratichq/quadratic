import { UsageBasedPricingDialog } from '@/dashboard/components/billing/UsageBasedPricingDialog';
import { formatToFractionalDollars, formatToWholeDollar } from '@/dashboard/components/billing/utils';
import { CycleIcon, WarningIcon } from '@/shared/components/Icons';
import { Badge } from '@/shared/shadcn/ui/badge';
import { Progress } from '@/shared/shadcn/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';

// Presentational component that doesn't know anything about state. Everything we pass in.
export function AIUsageIndividual({
  creditsMonthly,
  creditsAdditional,
}: {
  creditsMonthly: {
    used: number;
    limit: number;
  };

  // Optional means it's not a paid plan and this feature isn't available.
  creditsAdditional?: {
    used: number;
    limit: number;
    // Optional means the feature has been turned off by the team owner
    onChangeLimit?: (value: number) => void;
  };
}) {
  const creditsMonthlyUsedDisplay = formatToFractionalDollars(creditsMonthly.used);
  const creditsMonthlyLimitInteger = formatToWholeDollar(creditsMonthly.limit);
  const creditsMonthlyUsedPercentage = (creditsMonthly.used / creditsMonthly.limit) * 100;
  const creditsAdditionalExceeded = creditsAdditional && creditsAdditional.used > creditsAdditional.limit;
  const isProPlan = creditsAdditional !== undefined;
  const isProPlanAndUsageBasedPricingEnabled = isProPlan && creditsAdditional.onChangeLimit !== undefined;
  const hasHitMonthlyLimit = creditsMonthly.used === creditsMonthly.limit;

  return (
    <div className="grid grid-cols-2 gap-8 rounded-lg border border-border p-4 shadow-sm">
      <div className="flex flex-col">
        <div className="flex h-8 items-center gap-2 text-xl">
          <span className="font-semibold text-foreground">{creditsMonthlyUsedDisplay}</span>
          <span className="font-light text-muted-foreground opacity-40">/</span>
          <span className="text-muted-foreground">{creditsMonthlyLimitInteger}</span>
        </div>
        <Progress value={creditsMonthlyUsedPercentage} className="my-2 h-2" />
        <p className="h-6 text-sm font-semibold">Monthly credits</p>
        <p className="-mt-1 text-sm text-muted-foreground">Included with your current plan.</p>
      </div>
      <div className="flex flex-col">
        <div className="flex h-8 items-center gap-2 text-xl">
          {isProPlan ? (
            <>
              {creditsAdditionalExceeded && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="flex items-center">
                      <WarningIcon className="text-destructive" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-72">
                      <p>
                        You exceeded your limit by setting it lower than what you already spent. This limit will apply
                        next billing cycle.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <span
                className={cn(
                  creditsAdditionalExceeded && hasHitMonthlyLimit
                    ? 'font-semibold text-destructive'
                    : isProPlanAndUsageBasedPricingEnabled && hasHitMonthlyLimit
                      ? 'font-semibold text-foreground'
                      : 'text-muted-foreground'
                )}
              >
                {formatToFractionalDollars(creditsAdditional.used)}
              </span>

              <span className="font-light text-muted-foreground opacity-40">/</span>
              <span className="flex items-center gap-1 text-muted-foreground">
                {formatToFractionalDollars(creditsAdditional.limit)}{' '}
              </span>

              {isProPlanAndUsageBasedPricingEnabled && (
                <UsageBasedPricingDialog
                  currentLimitNumber={creditsAdditional.limit}
                  handleChange={(newValue) => {
                    return new Promise<boolean>((resolve) => {
                      setTimeout(() => {
                        // @ts-expect-error TODO: fix this
                        creditsAdditional.onChangeLimit(newValue);
                        resolve(true);
                      }, 1000);
                    }).catch((e) => {
                      return false;
                    });
                  }}
                />
              )}
            </>
          ) : (
            <>
              <span className="text-muted-foreground">---</span>
              <span className="font-light text-muted-foreground opacity-40">/</span>
              <span className="text-muted-foreground">---</span>
            </>
          )}
        </div>

        <Progress
          variant={creditsAdditionalExceeded ? 'destructive' : 'default'}
          value={isProPlan ? (creditsAdditional.used / creditsAdditional.limit) * 100 : 0}
          className={'my-2 h-2'}
        />

        <div
          className={cn(
            'flex h-6 items-center justify-between text-sm font-semibold',
            !isProPlan && 'text-muted-foreground'
          )}
        >
          Additional monthly credits
          {isProPlan && !isProPlanAndUsageBasedPricingEnabled && <Badge variant="secondary">Off</Badge>}
        </div>
        <p className={'-mt-0.5 text-sm text-muted-foreground'}>
          {!isProPlan
            ? 'Usage-based pricing available on Pro.'
            : isProPlanAndUsageBasedPricingEnabled
              ? 'Set your usage-based pricing limits.'
              : 'Contact the team owner for more credits.'}
        </p>
      </div>
      <p className="-mt-4 flex items-center gap-1 text-xs text-muted-foreground">
        {/* TODO: add date */}
        <CycleIcon /> Credits replenish: MMM DD
      </p>
    </div>
  );
}
