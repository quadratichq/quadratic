import type { NavigateToCreatePotentialView, NavigateToCreateView } from '@/shared/components/connections/Connections';
import { connectionsByType } from '@/shared/components/connections/connectionsByType';
import { AddIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import AffirmLogo from './logo-plaid-affirm.svg?react';
import AmexLogo from './logo-plaid-amex.svg?react';
import BOALogo from './logo-plaid-boa.svg?react';
import ChaseLogo from './logo-plaid-chase.svg?react';
import CitiLogo from './logo-plaid-citi.svg?react';
import CoinbaseLogo from './logo-plaid-coinbase.svg?react';
import DiscoverLogo from './logo-plaid-discover.svg?react';
import RobinhoodLogo from './logo-plaid-robinhood.svg?react';
import VanguardLogo from './logo-plaid-vanguard.svg?react';
import PlaidLogo from './logo-plaid.svg?react';

const plaidConnections = [
  { name: 'Banks', logos: [ChaseLogo, CitiLogo, BOALogo] },

  {
    name: 'Brokerages',
    logos: [VanguardLogo, RobinhoodLogo, CoinbaseLogo],
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

  return (
    <div className="flex flex-col gap-4">
      {Object.entries(connectionsByUiCategory).map(([category, connections]) => (
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
      ))}
      {plaidConnections.map(({ name, logos }) => (
        <div key={name}>
          <h3 className="text-sm font-semibold">{name}</h3>
          <div className="mb-2 mt-2">
            <button
              className="grid-template-columns-2 grid w-full grid-cols-2 grid-rows-2 items-center justify-items-center gap-4 rounded border border-border p-6 shadow-sm hover:bg-accent"
              onClick={() => handleNavigateToCreateView('PLAID')}
            >
              {logos.map((Logo) => (
                <Logo key={Logo.name} />
              ))}
              <Plaid />
            </button>
          </div>
        </div>
      ))}
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
