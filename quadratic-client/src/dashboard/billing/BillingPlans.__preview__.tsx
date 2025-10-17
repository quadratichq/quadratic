import { BillingPlans } from '@/dashboard/billing/BillingPlans';

export default function Component() {
  return (
    <div className="w-full max-w-xl space-y-12">
      <BillingPlans isOnPaidPlan={false} canManageBilling={true} teamUuid="123" />
      <BillingPlans isOnPaidPlan={false} canManageBilling={true} showActions={true} teamUuid="123" />
      <BillingPlans isOnPaidPlan={false} canManageBilling={false} showActions={true} teamUuid="123" />

      <BillingPlans isOnPaidPlan={true} canManageBilling={true} showActions={false} teamUuid="123" />
      <BillingPlans isOnPaidPlan={true} canManageBilling={true} showActions={true} teamUuid="123" />
      <BillingPlans isOnPaidPlan={true} canManageBilling={false} showActions={true} teamUuid="123" />
    </div>
  );
}
