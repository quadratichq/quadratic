import { Label } from '@/shared/shadcn/ui/label';
import { Slider } from '@/shared/shadcn/ui/slider';
import { Switch } from '@/shared/shadcn/ui/switch';
import { useState } from 'react';
import { AIUsageIndividual } from './AIUsageIndividual';

export default function Component() {
  return (
    <div className="-ml-[200px] flex max-w-4xl flex-col gap-4 pl-[200px]">
      <h2 className="text-lg font-semibold">Example</h2>
      <Example />

      <hr className="my-12" />

      <h2 className="text-lg font-semibold">Free plan</h2>
      <AIUsageIndividual creditsMonthly={{ used: 0, limit: 20 }} />
      <AIUsageIndividual creditsMonthly={{ used: 1.5, limit: 20 }} />
      <AIUsageIndividual creditsMonthly={{ used: 20, limit: 20 }} />

      <h2 className="mt-12 text-lg font-semibold">Paid plan, usage-based pricing ON</h2>
      <AIUsageIndividual
        creditsMonthly={{ used: 10, limit: 20 }}
        creditsAdditional={{ used: 0, limit: 0, onChangeLimit: () => {} }}
      />
      <AIUsageIndividual
        creditsMonthly={{ used: 10, limit: 20 }}
        creditsAdditional={{ used: 0, limit: 20, onChangeLimit: () => {} }}
      />
      <AIUsageIndividual
        creditsMonthly={{ used: 20, limit: 20 }}
        creditsAdditional={{ used: 15.75, limit: 20, onChangeLimit: () => {} }}
      />
      <AIUsageIndividual
        creditsMonthly={{ used: 20, limit: 20 }}
        creditsAdditional={{ used: 20, limit: 20, onChangeLimit: () => {} }}
      />
      <AIUsageIndividual
        creditsMonthly={{ used: 20, limit: 20 }}
        creditsAdditional={{ used: 40, limit: 20, onChangeLimit: () => {} }}
      />

      <h2 className="mt-12 text-lg font-semibold">Paid, usage-based pricing OFF</h2>
      <AIUsageIndividual creditsMonthly={{ used: 2.5, limit: 20 }} creditsAdditional={{ used: 0, limit: 0 }} />
      <AIUsageIndividual creditsMonthly={{ used: 20, limit: 20 }} creditsAdditional={{ used: 0, limit: 20 }} />
      <AIUsageIndividual creditsMonthly={{ used: 20, limit: 20 }} creditsAdditional={{ used: 1.5, limit: 20 }} />
      <AIUsageIndividual creditsMonthly={{ used: 20, limit: 20 }} creditsAdditional={{ used: 20, limit: 20 }} />
      <AIUsageIndividual creditsMonthly={{ used: 20, limit: 20 }} creditsAdditional={{ used: 40, limit: 20 }} />
    </div>
  );
}

function Example() {
  const limit = 20;
  const [isPaidPlan, setIsPaidPlan] = useState(true);
  const [usage, setUsage] = useState(0);
  const [usageBasedPricing, setUsageBasedPricing] = useState(false);

  return (
    <>
      <AIUsageIndividual
        creditsMonthly={{ used: usage > limit ? limit : usage, limit }}
        creditsAdditional={
          isPaidPlan
            ? {
                used: usage > limit ? usage - limit : 0,
                limit: 20,
                onChangeLimit: usageBasedPricing ? (limit) => {} : undefined,
              }
            : undefined
        }
      />
      <div className="flex justify-between gap-2">
        <div className="flex flex-row items-center gap-6">
          <div className="flex flex-row items-center gap-1">
            <Switch id="paid-plan" checked={isPaidPlan} onCheckedChange={setIsPaidPlan} />
            <Label htmlFor="paid-plan">Paid plan</Label>
          </div>
          <div className="flex flex-row items-center gap-1">
            <Switch id="usage-based-pricing" checked={usageBasedPricing} onCheckedChange={setUsageBasedPricing} />
            <Label htmlFor="usage-based-pricing">Usage-based pricing</Label>
          </div>
          <div className="flex flex-row items-center gap-1">
            <Slider
              id="usage"
              step={0.25}
              value={[usage]}
              onValueChange={(value) => {
                const val = value[0];
                if (isPaidPlan) {
                  setUsage(val);
                } else {
                  setUsage(value[0] > limit ? limit : value[0]);
                }
              }}
              max={60}
              className="w-40"
            />
            <Label htmlFor="usage">Usage</Label>
          </div>
        </div>
      </div>
    </>
  );
}
