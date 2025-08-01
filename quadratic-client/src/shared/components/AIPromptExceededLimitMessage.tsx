import { UsageBasedPricingDialog } from '@/dashboard/components/billing/UsageBasedPricingDialog';
import { Button } from '@/shared/shadcn/ui/button';
import { Link } from 'react-router';

/*
  <AIUserMessageFormLimitExceededMessage />

  Only triggers when limits are exceeded.
  {
    isPaidPlan: boolean;
    teamPermissions: string[];
    usageBasedPricingLimit: number | null;
  }

  Logic breakdown by plan type:

  if !isPaidPlan
    if teamPermissions.includes('TEAM_MANAGE')
      'upgrade-plan'
    else
      'contact-owner'

  else
    // If you're a viewer, you can't do anything.
    if !teamPermissions.includes('TEAM_EDIT')
      'contact-owner'

    // null means usage-based pricing is disabled.
    if usageBasedPricingLimit === null
      if teamPermissions.includes('TEAM_MANAGE')
        'enable-usage-based-pricing'
      else
        'contact-owner'
    else
      if usageBasedPricingLimit === 0
        'set-limit'
      else
        'increase-limit'
      
    else
      'upgrade-plan'
  else
    if settingHasAIUsageBasedPricingEnabled !== true
      'contact-owner'
    else
      'increase-limit'


  // If it's a viewer on a team, or if usage-based pricing is disabled, the only
  // thing they can do is contact the team owner.
  if !teamPermissions.includes('TEAM_EDIT') ||
  if settingHasAIUsageBasedPricingEnabled !== true
    'contact-owner'
  
  if isPaidPlan
*/

export default function AIPromptExceededLimitMessage({
  action,
}: {
  action: 'contact-owner' | 'upgrade-plan' | 'increase-limit' | 'set-limit' | 'manage-usage-based-credits';
}) {
  // If we're on the dashboard, don't reload. Otherwise, do!
  const reloadDocument = !window.location.pathname.startsWith('/teams/');

  if (action === 'set-limit') {
    return (
      <Component
        title="You’ve hit your limit of base credits"
        description="Continue by setting a usage-based credits spending limit."
        primaryAction={
          <UsageBasedPricingDialog currentLimitNumber={0} handleChange={() => Promise.resolve(true)}>
            <Button size="sm">Set usage-based credit limit</Button>
          </UsageBasedPricingDialog>
        }
        reloadDocument={reloadDocument}
      />
    );
  }

  if (action === 'increase-limit') {
    return (
      <Component
        title="You’ve hit your usage-based credit limit"
        description="Continue using AI by increasing your limit."
        primaryAction={
          <UsageBasedPricingDialog currentLimitNumber={20} handleChange={() => Promise.resolve(true)}>
            <Button size="sm">Increase limit</Button>
          </UsageBasedPricingDialog>
        }
        reloadDocument={reloadDocument}
      />
    );
  }

  if (action === 'upgrade-plan') {
    return (
      <Component
        title="You’ve hit your limit of base credits"
        description="Upgrade your plan for more AI credits, as well as other great features of Quadratic."
        primaryAction={
          <Button size="sm" asChild>
            <Link to={`/team/settings`} reloadDocument={reloadDocument}>
              Upgrade to Pro
            </Link>
          </Button>
        }
        reloadDocument={reloadDocument}
      />
    );
  }

  if (action === 'manage-usage-based-credits') {
    return (
      <Component
        title="You’ve hit your limit of AI credits"
        description="Usage-based credits are disabled for your team. You’ll have to re-enable them in your team’s Settings."
        primaryAction={
          <UsageBasedPricingDialog currentLimitNumber={20} handleChange={() => Promise.resolve(true)}>
            <Button size="sm">Manage AI credits in Settings</Button>
          </UsageBasedPricingDialog>
        }
        reloadDocument={true}
      />
    );
  }

  return (
    <Component
      title="You’ve hit your usage-based pricing limit"
      description="Continue using AI by contacting your team owner about billing."
      reloadDocument={reloadDocument}
    />
  );
}

function Component({
  title,
  description,
  primaryAction,
  reloadDocument,
}: {
  title: string;
  description: string;
  primaryAction?: React.ReactNode;
  reloadDocument: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded bg-accent p-4 text-center">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="mt-2 flex items-center justify-center gap-2">
        <Button size="sm" variant="link" asChild>
          <Link to={`/team/settings`} reloadDocument={reloadDocument}>
            View usage
          </Link>
        </Button>
        {primaryAction}
      </div>
    </div>
  );
}
