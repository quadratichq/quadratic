import { aiAnalystActiveSchemaConnectionUuidAtom, showAIAnalystAtom } from '@/app/atoms/aiAnalystAtom';
import { editorInteractionStateShowConnectionsMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { focusAIAnalyst } from '@/app/helpers/focusGrid';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import type { OnConnectionCreatedCallback } from '@/shared/components/connections/ConnectionForm';
import { Connections } from '@/shared/components/connections/Connections';
import { ConnectionSyncingStatusModal } from '@/shared/components/connections/ConnectionSyncingStatusModal';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { isSyncedConnectionType, type ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { useCallback, useState } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';

interface PendingSyncedConnection {
  uuid: string;
  type: ConnectionType;
  name: string;
}

export function ConnectionsMenu() {
  // State for the syncing status modal
  const [pendingSyncedConnection, setPendingSyncedConnection] = useState<PendingSyncedConnection | null>(null);
  const [showConnectionsMenu, setShowConnectionsMenu] = useRecoilState(editorInteractionStateShowConnectionsMenuAtom);
  const setShowAIAnalyst = useSetRecoilState(showAIAnalystAtom);
  const setAIAnalystActiveSchemaConnectionUuid = useSetRecoilState(aiAnalystActiveSchemaConnectionUuidAtom);

  const {
    team: { uuid: teamUuid, sshPublicKey },
  } = useFileRouteLoaderData();
  const { connections, staticIps, isLoading } = useConnectionsFetcher();

  // Shared logic for completing connection creation (opening AI panel, adding context pill)
  const completeConnectionCreation = useCallback(
    (connectionUuid: string, connectionType: ConnectionType, connectionName: string) => {
      // Close the connections dialog
      setShowConnectionsMenu(false);

      // Open the AI analyst panel with schema viewer
      setShowAIAnalyst(true);
      setAIAnalystActiveSchemaConnectionUuid(connectionUuid);

      // Add the connection as context in AI chat (without auto-submitting a prompt)
      events.emit('aiAnalystSelectConnection', connectionUuid, connectionType, connectionName);

      // Focus the AI analyst input
      focusAIAnalyst();
    },
    [setShowConnectionsMenu, setShowAIAnalyst, setAIAnalystActiveSchemaConnectionUuid]
  );

  const onConnectionCreated: OnConnectionCreatedCallback = useCallback(
    (connectionUuid, connectionType, connectionName) => {
      // For synced connections, show the syncing status modal instead of going directly to the sheet
      if (isSyncedConnectionType(connectionType)) {
        // Close the connections dialog but show the syncing modal
        setShowConnectionsMenu(false);
        setPendingSyncedConnection({
          uuid: connectionUuid,
          type: connectionType,
          name: connectionName,
        });
        return;
      }

      // For non-synced connections, proceed directly
      completeConnectionCreation(connectionUuid, connectionType, connectionName);
    },
    [setShowConnectionsMenu, completeConnectionCreation]
  );

  const handleSyncingModalUseConnection = useCallback(() => {
    if (pendingSyncedConnection) {
      completeConnectionCreation(
        pendingSyncedConnection.uuid,
        pendingSyncedConnection.type,
        pendingSyncedConnection.name
      );
      setPendingSyncedConnection(null);
    }
  }, [pendingSyncedConnection, completeConnectionCreation]);

  const handleSyncingModalViewErrorDetails = useCallback(() => {
    if (pendingSyncedConnection) {
      setPendingSyncedConnection(null);
      setShowConnectionsMenu({
        initialConnectionUuid: pendingSyncedConnection.uuid,
      });
    }
  }, [pendingSyncedConnection, setShowConnectionsMenu]);

  const handleSyncingModalClose = useCallback(() => {
    if (pendingSyncedConnection) {
      completeConnectionCreation(
        pendingSyncedConnection.uuid,
        pendingSyncedConnection.type,
        pendingSyncedConnection.name
      );
      setPendingSyncedConnection(null);
    }
  }, [pendingSyncedConnection, completeConnectionCreation]);

  const isOpen = showConnectionsMenu !== false;
  const menuState = typeof showConnectionsMenu === 'object' ? showConnectionsMenu : undefined;
  const initialView = menuState?.initialView ?? (showConnectionsMenu === true ? 'list' : undefined);
  const initialConnectionType = menuState?.initialConnectionType;
  const initialConnectionUuid = menuState?.initialConnectionUuid;

  return (
    <>
      <Dialog open={!!showConnectionsMenu} onOpenChange={() => setShowConnectionsMenu(false)}>
        <DialogContent
          className="max-w-4xl"
          onPointerDownOutside={(event) => {
            event.preventDefault();
          }}
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1">Manage team connections</DialogTitle>
          </DialogHeader>
          {/* Unmount it so we reset the state */}
          {isOpen && (
            <Connections
              connections={connections}
              connectionsAreLoading={isLoading}
              teamUuid={teamUuid}
              sshPublicKey={sshPublicKey}
              staticIps={staticIps}
              initialView={initialView}
              onConnectionCreated={onConnectionCreated}
              initialConnectionType={initialConnectionType}
              initialConnectionUuid={initialConnectionUuid}
            />
          )}
        </DialogContent>
      </Dialog>
      {/* Syncing status modal for newly created synced connections */}
      {pendingSyncedConnection && (
        <ConnectionSyncingStatusModal
          open={true}
          connectionUuid={pendingSyncedConnection.uuid}
          connectionType={pendingSyncedConnection.type}
          connectionName={pendingSyncedConnection.name}
          teamUuid={teamUuid}
          onUseConnection={handleSyncingModalUseConnection}
          onViewErrorDetails={handleSyncingModalViewErrorDetails}
          onClose={handleSyncingModalClose}
        />
      )}
    </>
  );
}
