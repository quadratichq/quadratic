import { WarningIcon } from '@/shared/components/Icons';
import type { useOverageSettings } from '@/shared/hooks/useOverageSettings';
import { Badge } from '@/shared/shadcn/ui/badge';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { Label } from '@/shared/shadcn/ui/label';
import { Switch } from '@/shared/shadcn/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';

interface OverageSettingsControlsProps {
  canManageAIOverage: boolean;
  idPrefix: string;
  overage: ReturnType<typeof useOverageSettings>;
}

export function OverageSettingsControls({ canManageAIOverage, idPrefix, overage }: OverageSettingsControlsProps) {
  const {
    aiUsageData,
    isLoadingUsage,
    onDemandUsage,
    isUpdatingOnDemand,
    spendingLimit,
    setSpendingLimit,
    isUpdatingLimit,
    hasSpendingLimitChanged,
    handleOnDemandToggle,
    handleSpendingLimitSave,
  } = overage;

  const toggleId = `${idPrefix}-on-demand`;
  const limitId = `${idPrefix}-spending-limit`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <Label
            htmlFor={toggleId}
            className={`text-sm font-medium ${!canManageAIOverage ? 'text-muted-foreground' : ''}`}
          >
            On-demand usage
          </Label>
          <p className="text-sm text-muted-foreground">
            Enable users who hit their included usage limit to use additional AI.
          </p>
        </div>
        <div className="flex-shrink-0">
          <Switch
            id={toggleId}
            checked={onDemandUsage}
            onCheckedChange={handleOnDemandToggle}
            disabled={!canManageAIOverage || isLoadingUsage || isUpdatingOnDemand}
            aria-label="Toggle on-demand usage"
          />
        </div>
      </div>

      {aiUsageData?.teamCurrentMonthOverageCost != null && aiUsageData.teamCurrentMonthOverageCost > 0 && (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <span className="text-sm font-medium">Current billed overage this period</span>
              <p className="text-sm text-muted-foreground">
                The amount billed so far for on-demand usage beyond the included allowance.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {aiUsageData.teamMonthlyBudgetLimit != null &&
                aiUsageData.teamCurrentMonthOverageCost >= aiUsageData.teamMonthlyBudgetLimit && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="destructive-secondary" className="gap-1">
                          <WarningIcon size="sm" />
                          Limit reached
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>The team spending limit has been reached</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              <p className="text-sm font-semibold">${aiUsageData.teamCurrentMonthOverageCost.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      {onDemandUsage && (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <Label
                htmlFor={limitId}
                className={`text-sm font-medium ${!canManageAIOverage ? 'text-muted-foreground' : ''}`}
              >
                Team spending limit
              </Label>
              <p className="text-sm text-muted-foreground">
                Limits how much the team can spend on overage (usage beyond the included allowance) each month.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-[140px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id={limitId}
                  type="number"
                  min="0"
                  step="1"
                  value={spendingLimit}
                  onChange={(e) => setSpendingLimit(e.target.value)}
                  placeholder="No limit"
                  className="pl-7"
                  disabled={!canManageAIOverage || isLoadingUsage}
                />
              </div>
              {canManageAIOverage && (
                <Button
                  size="sm"
                  onClick={handleSpendingLimitSave}
                  disabled={!hasSpendingLimitChanged || isUpdatingLimit || isLoadingUsage}
                >
                  {isUpdatingLimit ? 'Saving\u2026' : 'Save'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
