import { aiAnalystActiveSchemaConnectionUuidAtom, showAIAnalystAtom } from '@/app/atoms/aiAnalystAtom';
import {
  editorInteractionStateShowConnectionsMenuAtom,
  editorInteractionStateTeamUuidAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { focusGrid } from '@/app/helpers/focusGrid';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { SidebarToggle, SidebarTooltip } from '@/app/ui/QuadraticSidebar';
import { ConnectionsMenuContent } from '@/shared/components/connections/ConnectionsMenuContent';
import { DatabaseIcon } from '@/shared/components/Icons';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/shared/shadcn/ui/dropdown-menu';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { memo, useCallback } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

interface ConnectionsSidebarMenuProps {
  'data-walkthrough'?: string;
}

export const ConnectionsSidebarMenu = memo(({ 'data-walkthrough': dataWalkthrough }: ConnectionsSidebarMenuProps) => {
  const { connections } = useConnectionsFetcher();
  const teamUuid = useRecoilValue(editorInteractionStateTeamUuidAtom);
  const setShowAIAnalyst = useSetRecoilState(showAIAnalystAtom);
  const setAIAnalystActiveSchemaConnectionUuid = useSetRecoilState(aiAnalystActiveSchemaConnectionUuidAtom);
  const setShowConnectionsMenu = useSetRecoilState(editorInteractionStateShowConnectionsMenuAtom);

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
  const handleAddConnection = useCallback((type: ConnectionType) => {
    trackEvent('[ConnectionsSidebarMenu].addConnection', { type });
  }, []);

  // Handle clicking "Manage connections"
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
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          focusGrid();
        }}
      >
        <ConnectionsMenuContent
          connections={connections}
          teamUuid={teamUuid}
          onSelectConnection={handleSelectConnection}
          onAddConnection={handleAddConnection}
          onManageConnections={handleManageConnections}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

ConnectionsSidebarMenu.displayName = 'ConnectionsSidebarMenu';
