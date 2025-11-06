import { BillingPlans } from '@/dashboard/billing/BillingPlans';

export default function Component() {
  return (
    <div className="w-full max-w-xl space-y-12">
      <BillingPlans isOnPaidPlan={false} canManageBilling={true} teamUuid="123" eventSource="preview" />
      <BillingPlans isOnPaidPlan={false} canManageBilling={false} teamUuid="123" eventSource="preview" />

      <BillingPlans isOnPaidPlan={true} canManageBilling={true} teamUuid="123" eventSource="preview" />
      <BillingPlans isOnPaidPlan={true} canManageBilling={false} teamUuid="123" eventSource="preview" />
    </div>
  );
}
