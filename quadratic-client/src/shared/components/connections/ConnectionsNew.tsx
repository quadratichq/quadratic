import type {
  NavigateToCreatePotentialView,
  NavigateToCreateView,
  PlaidCategory,
} from '@/shared/components/connections/Connections';
import { connectionsByType } from '@/shared/components/connections/connectionsByType';
import { AddIcon, FeedbackIcon } from '@/shared/components/Icons';
import { Alert, AlertDescription, AlertTitle } from '@/shared/shadcn/ui/alert';
import { Button } from '@/shared/shadcn/ui/button';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import AffirmLogo from './logo-plaid-affirm.svg?react';
import AmexLogo from './logo-plaid-amex.svg?react';
import BOALogo from './logo-plaid-boa.svg?react';
import ChaseLogo from './logo-plaid-chase.svg?react';
import CitiLogo from './logo-plaid-citi.svg?react';
import DiscoverLogo from './logo-plaid-discover.svg?react';
import FidelityLogo from './logo-plaid-fidelity.svg?react';
import RobinhoodLogo from './logo-plaid-robinhood.svg?react';
import VanguardLogo from './logo-plaid-vanguard.svg?react';
import PlaidLogo from './logo-plaid.svg?react';

const plaidConnections: Array<{ name: PlaidCategory; logos: React.ComponentType[] }> = [
  { name: 'Banks', logos: [ChaseLogo, CitiLogo, BOALogo] },

  {
    name: 'Brokerages',
    logos: [RobinhoodLogo, FidelityLogo, VanguardLogo],
  },
  {
    name: 'Credit Cards',
    logos: [AffirmLogo, DiscoverLogo, AmexLogo],
  },
];

export const ConnectionsNew = ({
  handleNavigateToCreateView,
  handleNavigateToCreatePotentialView,
}: {
  handleNavigateToCreateView: NavigateToCreateView;
  handleNavigateToCreatePotentialView: NavigateToCreatePotentialView;
}) => {
  const connectionsByUiCategory = Object.groupBy(
    Object.entries(connectionsByType).filter(([, { uiCategory }]) => uiCategory !== undefined),
    ([, { uiCategory }]) => uiCategory!
  );

  // Separate Databases from other categories to render last
  const { Databases: databaseConnections, ...otherCategories } = connectionsByUiCategory;

  const renderCategory = (category: string, connections: typeof databaseConnections) => (
    <div key={category}>
      <h3 className="text-sm font-semibold">{category}</h3>
      <div className="mb-2 mt-2 grid grid-cols-2 gap-4">
        {connections?.map(([type, { Logo }]) => (
          <Button
            data-testid={`new-connection-${type}`}
            key={type}
            variant="outline"
            className="group relative h-auto w-full"
            onClick={() => {
              handleNavigateToCreateView(type as ConnectionType);
            }}
          >
            <AddIcon className="absolute bottom-1 right-1 opacity-30 group-hover:opacity-100" />
            <Logo className="h-[40px] w-[160px]" />
          </Button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Other categories (Analytics, etc.) */}
      {Object.entries(otherCategories).map(([category, connections]) => renderCategory(category, connections))}

      {/* Plaid connections */}
      {plaidConnections.map(({ name, logos }) => (
        <div key={name}>
          <h3 className="text-sm font-semibold">{name}</h3>
          <div className="mb-2 mt-2">
            <button
              className="grid-template-columns-2 grid w-full grid-cols-2 grid-rows-2 items-center justify-items-center gap-4 rounded border border-border p-6 shadow-sm hover:bg-accent"
              onClick={() => handleNavigateToCreateView('PLAID', name)}
            >
              {logos.map((Logo) => (
                <Logo key={Logo.name} />
              ))}
              <Plaid />
            </button>
          </div>
        </div>
      ))}

      {/* Databases (rendered last) */}
      {databaseConnections && renderCategory('Databases', databaseConnections)}

      <div className="mt-2">
        <button
          className="bg-background text-left shadow-sm hover:bg-accent"
          onClick={() => handleNavigateToCreatePotentialView('OTHER')}
        >
          <Alert className="bg-inherit">
            <FeedbackIcon />
            <AlertTitle>Suggest a connection…</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              Let us know what data source you'd like to connect and we'll consider adding it.
            </AlertDescription>
          </Alert>
        </button>
      </div>
    </div>
  );
};

function Plaid() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      …and more with
      <PlaidLogo className="fill-inherit" />
    </div>
  );
}
