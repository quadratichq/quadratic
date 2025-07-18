import { apiClient } from '@/shared/api/apiClient';
import { CheckIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import mixpanel from 'mixpanel-browser';
import { Link } from 'react-router';

export const BillingPlans = ({
  canManageBilling,
  isOnPaidPlan,
  teamUuid,
}: {
  canManageBilling: boolean;
  isOnPaidPlan: boolean;
  teamUuid: string;
}) => {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Plan isActive={!isOnPaidPlan}>
        <PlanHeader name="Personal" price="Free" />
        <PlanFeatures features={['Limited monthly AI credits', 'Unlimited personal files']} />
      </Plan>
      <Plan isActive={isOnPaidPlan}>
        <PlanHeader name="Pro" price="$20" priceQualifier="/user/month" />
        <PlanFeatures
          features={[
            '$20 of monthly AI credits per user',
            'Usage-based pricing after AI credits',
            'Unlimited personal files',
            'Unlimited sharing',
            'Priority support',
          ]}
        />

        {isOnPaidPlan ? (
          <Button
            disabled={!canManageBilling}
            variant="outline"
            className="mt-2"
            onClick={() => {
              mixpanel.track('[TeamSettings].manageBillingClicked', {
                team_uuid: teamUuid,
              });
              apiClient.teams.billing.getPortalSessionUrl(teamUuid).then((data) => {
                window.location.href = data.url;
              });
            }}
          >
            Manage billing
          </Button>
        ) : (
          <Button
            className="mt-2"
            disabled={!canManageBilling}
            onClick={() => {
              mixpanel.track('[TeamSettings].upgradeToProClicked', {
                team_uuid: teamUuid,
              });
              apiClient.teams.billing.getCheckoutSessionUrl(teamUuid).then((data) => {
                window.location.href = data.url;
              });
            }}
          >
            Upgrade to Pro
          </Button>
        )}
        {!canManageBilling && (
          <p className="text-center text-xs text-muted-foreground">
            Contact{' '}
            <Link to={ROUTES.TEAM_MEMBERS(teamUuid)} className="underline">
              the team owner
            </Link>{' '}
            to change billing.
          </p>
        )}
      </Plan>
    </div>
  );
};

function Plan({ isActive, children }: { isActive: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded border p-4',
        isActive ? 'border-foreground ring-2 ring-foreground/10' : 'border-border text-muted-foreground'
      )}
    >
      {children}
    </div>
  );
}

function PlanHeader({ name, price, priceQualifier }: { name: string; price: string; priceQualifier?: string }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-semibold">{name}</h3>
      <p className="flex items-baseline gap-0.5">
        <span className="text-lg font-semibold">{price}</span>
        {priceQualifier && <span className="text-xs text-muted-foreground">{priceQualifier}</span>}
      </p>
    </div>
  );
}

function PlanFeatures({ features }: { features: string[] }) {
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {features.map((feature) => (
        <li key={feature} className="flex gap-2">
          <CheckIcon className="opacity-100" /> {feature}
        </li>
      ))}
    </ul>
  );
}
