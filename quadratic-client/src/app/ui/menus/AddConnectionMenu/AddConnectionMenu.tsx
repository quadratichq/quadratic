import {
  editorInteractionStateShowAddConnectionMenuAtom,
  editorInteractionStateShowConnectionsMenuAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { ConnectionIcon } from '@/shared/components/ConnectionIcon';
import { connectionsByType } from '@/shared/components/connections/connectionsByType';
import { BankIcon, BrokerageIcon, CreditCardIcon } from '@/shared/components/Icons';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/shared/shadcn/ui/command';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { memo, useCallback, useMemo } from 'react';
import { useSetRecoilState } from 'recoil';

export const AddConnectionMenu = memo(() => {
  const setShowAddConnectionMenu = useSetRecoilState(editorInteractionStateShowAddConnectionMenuAtom);
  const setShowConnectionsMenu = useSetRecoilState(editorInteractionStateShowConnectionsMenuAtom);

  const connectionTypesByCategory = useMemo(() => {
    const grouped = Object.groupBy(
      Object.entries(connectionsByType).filter(([, { uiCategory }]) => uiCategory !== undefined),
      ([, { uiCategory }]) => uiCategory!
    );

    return {
      Analytics: grouped['Analytics'] ?? [],
      Databases: grouped['Databases'] ?? [],
    };
  }, []);

  const close = useCallback(() => {
    setShowAddConnectionMenu(false);
  }, [setShowAddConnectionMenu]);

  const selectConnectionType = useCallback(
    (type: ConnectionType) => {
      setShowAddConnectionMenu(false);
      setShowConnectionsMenu({ initialConnectionType: type });
    },
    [setShowAddConnectionMenu, setShowConnectionsMenu]
  );

  return (
    <CommandDialog
      dialogProps={{ open: true, onOpenChange: close }}
      commandProps={{
        filter: (value, search) => {
          if (!search) return 1;
          return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
        },
      }}
      overlayProps={{ onPointerDown: (e) => e.preventDefault() }}
    >
      <CommandInput placeholder="Choose a connection type…" />

      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="SaaS">
          {connectionTypesByCategory.Analytics.map(([type, { name }]) => (
            <ConnectionTypeItem
              key={type}
              name={name}
              icon={<ConnectionIcon type={type} />}
              onSelect={() => selectConnectionType(type as ConnectionType)}
            />
          ))}
        </CommandGroup>
        <CommandSeparator />

        <CommandGroup heading="Financial institutions">
          <ConnectionTypeItem
            name="Bank accounts"
            icon={<BankIcon className="text-muted-foreground opacity-80" />}
            value="Bank accounts Plaid"
            onSelect={() => selectConnectionType('PLAID')}
          />
          <ConnectionTypeItem
            name="Brokerages"
            icon={<BrokerageIcon className="text-muted-foreground opacity-80" />}
            value="Brokerages Plaid"
            onSelect={() => selectConnectionType('PLAID')}
          />
          <ConnectionTypeItem
            name="Credit cards"
            icon={<CreditCardIcon className="text-muted-foreground opacity-80" />}
            value="Credit cards Plaid"
            onSelect={() => selectConnectionType('PLAID')}
          />
        </CommandGroup>
        <CommandSeparator />

        <CommandGroup heading="Databases">
          {connectionTypesByCategory.Databases.map(([type, { name }]) => (
            <ConnectionTypeItem
              key={type}
              name={name}
              icon={<ConnectionIcon type={type} />}
              onSelect={() => selectConnectionType(type as ConnectionType)}
            />
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
});

AddConnectionMenu.displayName = 'AddConnectionMenu';

const ConnectionTypeItem = memo(
  ({ name, icon, value, onSelect }: { name: string; icon: React.ReactNode; value?: string; onSelect: () => void }) => (
    <CommandItem
      onSelect={onSelect}
      value={value ?? name}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div className="mr-4 flex h-5 w-5 items-center">{icon}</div>
      <span className="truncate">{name}</span>
    </CommandItem>
  )
);

ConnectionTypeItem.displayName = 'ConnectionTypeItem';
