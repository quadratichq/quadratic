import { BillingPlans } from './BillingPlans';

export default function Component() {
  return (
    <div className="-ml-[200px] flex max-w-4xl flex-col gap-4 pl-[200px]">
      <h2 className="text-lg font-semibold">Free, editor</h2>
      <BillingPlans canManageBilling={false} isOnPaidPlan={false} teamUuid={'foo'} />
      <h2 className="text-lg font-semibold">Free, owner</h2>
      <BillingPlans canManageBilling={true} isOnPaidPlan={false} teamUuid={'foo'} />
      <h2 className="text-lg font-semibold">Paid, editor</h2>
      <BillingPlans canManageBilling={false} isOnPaidPlan={true} teamUuid={'foo'} />
      <h2 className="text-lg font-semibold">Paid, owner</h2>
      <BillingPlans canManageBilling={true} isOnPaidPlan={true} teamUuid={'foo'} />
    </div>
  );
}
