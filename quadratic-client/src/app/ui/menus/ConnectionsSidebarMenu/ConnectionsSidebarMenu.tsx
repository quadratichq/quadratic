import { aiAnalystActiveSchemaConnectionUuidAtom, showAIAnalystAtom } from '@/app/atoms/aiAnalystAtom';
import { editorInteractionStateShowConnectionsMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { SidebarToggle, SidebarTooltip } from '@/app/ui/QuadraticSidebar';
import { connectionsByType } from '@/shared/components/connections/connectionsByType';
import {
  AddIcon,
  BankIcon,
  BrokerageIcon,
  CreditCardIcon,
  DatabaseIcon,
  SettingsIcon,
} from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { memo, useCallback, useMemo } from 'react';
import { useSetRecoilState } from 'recoil';

interface ConnectionsSidebarMenuProps {
  'data-walkthrough'?: string;
}

export const ConnectionsSidebarMenu = memo(({ 'data-walkthrough': dataWalkthrough }: ConnectionsSidebarMenuProps) => {
  const { connections } = useConnectionsFetcher();
  const setShowAIAnalyst = useSetRecoilState(showAIAnalystAtom);
  const setAIAnalystActiveSchemaConnectionUuid = useSetRecoilState(aiAnalystActiveSchemaConnectionUuidAtom);
  const setShowConnectionsMenu = useSetRecoilState(editorInteractionStateShowConnectionsMenuAtom);

  // Group connection types by category for "Add connection" submenu
  const connectionTypesByCategory = useMemo(() => {
    const grouped = Object.groupBy(
      Object.entries(connectionsByType).filter(([, { uiCategory }]) => uiCategory !== undefined),
      ([, { uiCategory }]) => uiCategory!
    );

    // Reorganize to match the screenshot: SaaS first, then Databases
    return {
      SaaS: grouped['Analytics'] ?? [],
      Databases: grouped['Databases'] ?? [],
    };
  }, []);

  // Handle clicking on an available connection - add to AI context and open AI panel
  const handleSelectConnection = useCallback(
    (connectionUuid: string, connectionType: ConnectionType, connectionName: string) => {
      trackEvent('[ConnectionsSidebarMenu].selectConnection', { language: connectionType });
      // Set the active schema connection (this shows the schema in the AI panel)
      setAIAnalystActiveSchemaConnectionUuid(connectionUuid);
      // Open the AI panel
      setShowAIAnalyst(true);
    },
    [setAIAnalystActiveSchemaConnectionUuid, setShowAIAnalyst]
  );

  // Handle clicking "Add connection" -> specific type
  const handleAddConnection = useCallback(
    (type: ConnectionType) => {
      trackEvent('[ConnectionsSidebarMenu].addConnection', { type });
      setShowConnectionsMenu({ initialConnectionType: type });
    },
    [setShowConnectionsMenu]
  );

  // Handle clicking "Manage connections" -> specific connection
  const handleManageConnections = useCallback(() => {
    trackEvent('[ConnectionsSidebarMenu].manageConnections');
    setShowConnectionsMenu(true);
  }, [setShowConnectionsMenu]);

  return (
    <DropdownMenu>
      <SidebarTooltip label="Connections">
        <DropdownMenuTrigger asChild>
          <SidebarToggle pressed={false} data-walkthrough={dataWalkthrough}>
            <DatabaseIcon />
          </SidebarToggle>
        </DropdownMenuTrigger>
      </SidebarTooltip>

      <DropdownMenuContent
        side="right"
        align="start"
        className="max-w-72"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {/* Available connections list */}
        {connections.length > 0 && (
          <>
            {connections.map((connection) => (
              <DropdownMenuItem
                key={connection.uuid}
                onClick={() => handleSelectConnection(connection.uuid, connection.type, connection.name)}
                className="gap-3"
              >
                <LanguageIcon language={connection.type} className="flex-shrink-0" />
                <span className="truncate">
                  {connection.name}
                  {connection.isDemo && ' (read-only)'}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuSeparator className="!block" />

        {/* Add connection submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-3">
            <AddIcon className="flex-shrink-0" />
            <span>Add connection</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="min-w-48">
              {/* SaaS category */}
              <DropdownMenuLabel className="text-xs text-muted-foreground">SaaS</DropdownMenuLabel>
              {connectionTypesByCategory.SaaS.map(([type, { name }]) => (
                <DropdownMenuItem
                  key={type}
                  onClick={() => handleAddConnection(type as ConnectionType)}
                  className="gap-3"
                >
                  <LanguageIcon language={type} className="flex-shrink-0" />
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
                    <DropdownMenuItem onClick={() => handleAddConnection('PLAID')}>
                      Connect with Plaid…
                    </DropdownMenuItem>
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
                    <DropdownMenuItem onClick={() => handleAddConnection('PLAID')}>
                      Connect with Plaid…
                    </DropdownMenuItem>
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
                    <DropdownMenuItem onClick={() => handleAddConnection('PLAID')}>
                      Connect with Plaid…
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>

              <DropdownMenuSeparator className="!block" />

              {/* Databases category */}
              <DropdownMenuLabel className="text-xs text-muted-foreground">Databases</DropdownMenuLabel>
              {connectionTypesByCategory.Databases.map(([type, { name }]) => (
                <DropdownMenuItem
                  key={type}
                  onClick={() => handleAddConnection(type as ConnectionType)}
                  className="gap-3"
                >
                  <LanguageIcon language={type} className="flex-shrink-0" />
                  <span>{name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="!block" />
              <DropdownMenuItem onClick={() => alert('TODO')} className="gap-3">
                <DatabaseIcon className="flex-shrink-0" /> Other…
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        {/* Manage connections submenu */}
        <DropdownMenuItem onClick={handleManageConnections} className="gap-3">
          <SettingsIcon className="flex-shrink-0" />
          <span>Manage connections</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

ConnectionsSidebarMenu.displayName = 'ConnectionsSidebarMenu';
