import { BillingPlans } from '@/dashboard/billing/BillingPlans';

export default function Component() {
  return (
    <div className="w-full max-w-5xl space-y-12">
      <BillingPlans isOnPaidPlan={false} canManageBilling={true} teamUuid="123" eventSource="preview" planType="FREE" />
      <BillingPlans
        isOnPaidPlan={false}
        canManageBilling={false}
        teamUuid="123"
        eventSource="preview"
        planType="FREE"
      />

      <BillingPlans isOnPaidPlan={true} canManageBilling={true} teamUuid="123" eventSource="preview" planType="PRO" />
      <BillingPlans isOnPaidPlan={true} canManageBilling={false} teamUuid="123" eventSource="preview" planType="PRO" />

      <BillingPlans
        isOnPaidPlan={true}
        canManageBilling={true}
        teamUuid="123"
        eventSource="preview"
        planType="BUSINESS"
      />
      <BillingPlans
        isOnPaidPlan={true}
        canManageBilling={false}
        teamUuid="123"
        eventSource="preview"
        planType="BUSINESS"
      />
    </div>
  );
}
