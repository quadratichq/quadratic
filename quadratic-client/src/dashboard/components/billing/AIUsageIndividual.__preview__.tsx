import { AIUsageIndividual } from './AIUsageIndividual';

export default function Component() {
  return (
    <div className="-ml-[200px] flex max-w-4xl flex-col gap-4 pl-[200px]">
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
