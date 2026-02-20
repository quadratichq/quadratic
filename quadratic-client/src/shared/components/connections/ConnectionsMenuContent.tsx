import { editorInteractionStateShowConnectionsMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { getConnectionSyncInfo } from '@/app/atoms/useSyncedConnection';
import { ConnectionIcon } from '@/shared/components/ConnectionIcon';
import { AddIcon, BankIcon, BrokerageIcon, CheckIcon, CreditCardIcon, SettingsIcon } from '@/shared/components/Icons';
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { cn } from '@/shared/shadcn/utils';
import type { ConnectionList, ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';

import { trackEvent } from '@/shared/utils/analyticsEvents';
import { memo, useCallback, useMemo, useRef } from 'react';
import { useSetRecoilState } from 'recoil';
import { connectionsByType } from './connectionsByType';

// ============================================================================
// Add Connection Menu Items (reusable content for dropdowns)
// ============================================================================

export interface AddConnectionMenuItemsProps {
  onAddConnection?: (type: ConnectionType) => void;
}

/**
 * Reusable menu items for adding a new connection.
 * Can be used inside DropdownMenuContent, DropdownMenuSubContent, etc.
 */
export const AddConnectionMenuItems = memo(({ onAddConnection }: AddConnectionMenuItemsProps) => {
  const setShowConnectionsMenu = useSetRecoilState(editorInteractionStateShowConnectionsMenuAtom);
  // Group connection types by category
  const connectionTypesByCategory = useMemo(() => {
    const grouped = Object.groupBy(
      Object.entries(connectionsByType).filter(([, { uiCategory }]) => uiCategory !== undefined),
      ([, { uiCategory }]) => uiCategory!
    );

    return {
      SaaS: grouped['Analytics'] ?? [],
      Databases: grouped['Databases'] ?? [],
    };
  }, []);

  const handleAddConnection = useCallback(
    (type: ConnectionType) => {
      setShowConnectionsMenu({ connectionType: type });
      onAddConnection?.(type);
    },
    [onAddConnection, setShowConnectionsMenu]
  );

  return (
    <>
      {/* SaaS category */}
      <DropdownMenuLabel className="text-xs text-muted-foreground">SaaS</DropdownMenuLabel>
      {connectionTypesByCategory.SaaS.map(([type, { name }]) => (
        <DropdownMenuItem key={type} onClick={() => handleAddConnection(type as ConnectionType)} className="gap-3">
          <ConnectionIcon type={type} className="flex-shrink-0" />
          <span>{name}</span>
        </DropdownMenuItem>
      ))}

      <DropdownMenuSeparator />

      {/* Financial institutions */}
      <DropdownMenuLabel className="text-xs text-muted-foreground">Financial institutions</DropdownMenuLabel>

      {/* Bank accounts submenu */}
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="gap-3">
          <BankIcon className="flex-shrink-0" />
          <span>Bank accounts</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuPortal>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => handleAddConnection('PLAID')}>Connect with Plaid…</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuPortal>
      </DropdownMenuSub>

      {/* Brokerages submenu */}
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="gap-3">
          <BrokerageIcon className="flex-shrink-0" />
          <span>Brokerages</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuPortal>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => handleAddConnection('PLAID')}>Connect with Plaid…</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuPortal>
      </DropdownMenuSub>

      {/* Credit cards submenu */}
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="gap-3">
          <CreditCardIcon className="flex-shrink-0" />
          <span>Credit cards</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuPortal>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => handleAddConnection('PLAID')}>Connect with Plaid…</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuPortal>
      </DropdownMenuSub>

      <DropdownMenuSeparator className="!block" />

      {/* Databases category */}
      <DropdownMenuLabel className="text-xs text-muted-foreground">Databases</DropdownMenuLabel>
      {connectionTypesByCategory.Databases.map(([type, { name }]) => (
        <DropdownMenuItem key={type} onClick={() => handleAddConnection(type as ConnectionType)} className="gap-3">
          <ConnectionIcon type={type} className="flex-shrink-0" />
          <span>{name}</span>
        </DropdownMenuItem>
      ))}
    </>
  );
});

AddConnectionMenuItems.displayName = 'AddConnectionMenuItems';

// ============================================================================
// Connection Menu Item
// ============================================================================

interface ConnectionMenuItemProps {
  connection: ConnectionList[number];
  isActive: boolean;
  onClick: () => void;
  source: ConnectionsMenuContentProps['source'];
}

const ConnectionMenuItem = memo(({ connection, isActive, onClick, source }: ConnectionMenuItemProps) => {
  const setShowConnectionsMenu = useSetRecoilState(editorInteractionStateShowConnectionsMenuAtom);
  const { syncState, isReadyForUse } = getConnectionSyncInfo(connection);
  const manageClickedRef = useRef(false);

  const handleClick = useCallback(() => {
    if (manageClickedRef.current) {
      manageClickedRef.current = false;
      return;
    }
    trackEvent('[ConnectionsMenuContent].select', { type: connection.type, source });
    if (isReadyForUse) {
      onClick();
    } else {
      setShowConnectionsMenu({ connectionUuid: connection.uuid, connectionType: connection.type });
    }
  }, [isReadyForUse, setShowConnectionsMenu, connection.uuid, connection.type, onClick, source]);

  const handleManageClick = useCallback(() => {
    // Don't use e.stopPropagation() here because we want to allow the click to
    // bubble up to the parent dropdown menu so it closes, and we'll handle the
    // manage connection in handleClick() instead.
    manageClickedRef.current = true;
    trackEvent('[ConnectionsMenuContent].manage', { type: connection.type, source });
    setShowConnectionsMenu({ connectionUuid: connection.uuid, connectionType: connection.type });
  }, [setShowConnectionsMenu, connection.uuid, connection.type, source]);

  return (
    <DropdownMenuItem onClick={handleClick} className="group flex items-center gap-3">
      <ConnectionIcon type={connection.type} syncState={syncState} className="flex-shrink-0" />
      <span className="flex items-center truncate">
        <span className="truncate">
          {connection.name}
          {connection.isDemo && ' (read-only)'}
        </span>
      </span>
      <CheckIcon
        className={cn('ml-auto flex-shrink-0 group-hover:invisible', isActive ? 'visible' : 'invisible opacity-0')}
      />
      <button
        className="group/button absolute right-2 top-1.5 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
        onClick={handleManageClick}
      >
        <SettingsIcon />
      </button>
    </DropdownMenuItem>
  );
});

ConnectionMenuItem.displayName = 'ConnectionMenuItem';

export interface ConnectionsMenuContentProps {
  connections: ConnectionList;
  activeConnectionId?: string;
  /** When true, shows Add/Manage actions before connections list. Default: false (connections first) */
  actionsFirst?: boolean;
  onSelectConnection: (uuid: string, type: ConnectionType, name: string) => void;
  onAddConnection: (type: ConnectionType) => void;
  source: 'sidebar' | 'ai-prompt';
}

export const ConnectionsMenuContent = memo(
  ({
    connections,
    activeConnectionId,
    actionsFirst = false,
    onSelectConnection,
    onAddConnection,
    source,
  }: ConnectionsMenuContentProps) => {
    const connectionsList = connections.length > 0 && (
      <>
        {connections.map((connection) => (
          <ConnectionMenuItem
            key={connection.uuid}
            connection={connection}
            isActive={activeConnectionId === connection.uuid}
            onClick={() => onSelectConnection(connection.uuid, connection.type, connection.name)}
            source={source}
          />
        ))}
      </>
    );

    const actionItems = (
      <>
        {/* Add connection submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-3">
            <AddIcon className="flex-shrink-0" />
            <span>Add connection</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="min-w-48">
              <AddConnectionMenuItems onAddConnection={onAddConnection} />
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
      </>
    );

    return (
      <>
        {actionsFirst ? (
          <>
            {actionItems}
            {connectionsList && (
              <>
                <DropdownMenuSeparator className="!block" />
                {connectionsList}
              </>
            )}
          </>
        ) : (
          <>
            {connectionsList && (
              <>
                {connectionsList}
                <DropdownMenuSeparator className="!block" />
              </>
            )}
            {actionItems}
          </>
        )}
      </>
    );
  }
);

ConnectionsMenuContent.displayName = 'ConnectionsMenuContent';
