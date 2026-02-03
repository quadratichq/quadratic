import { aiAnalystActiveSchemaConnectionUuidAtom, showAIAnalystAtom } from '@/app/atoms/aiAnalystAtom';
import { editorInteractionStateShowConnectionsMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { Connections, type OnConnectionSelectedCallback } from '@/shared/components/connections/Connections';
import type { OnConnectionCreatedCallback } from '@/shared/components/connections/ConnectionForm';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { useCallback } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';

export function ConnectionsMenu() {
  const [showConnectionsMenu, setShowConnectionsMenu] = useRecoilState(editorInteractionStateShowConnectionsMenuAtom);
  const setShowAIAnalyst = useSetRecoilState(showAIAnalystAtom);
  const setAIAnalystActiveSchemaConnectionUuid = useSetRecoilState(aiAnalystActiveSchemaConnectionUuidAtom);

  const {
    team: { uuid: teamUuid, sshPublicKey },
  } = useFileRouteLoaderData();
  const { connections, staticIps, isLoading } = useConnectionsFetcher();

  // Show 'new' view if explicitly requested, or if user has no real connections (only demo or none)
  const hasOnlyDemoConnections =
    !isLoading && (connections.length === 0 || connections.every((c) => c.isDemo === true));
  const initialView = showConnectionsMenu === 'new' || hasOnlyDemoConnections ? 'new' : 'list';

  const onConnectionCreated: OnConnectionCreatedCallback = useCallback(
    (connectionUuid, connectionType, connectionName) => {
      // Close the connections dialog
      setShowConnectionsMenu(false);

      // Open the AI analyst panel
      setShowAIAnalyst(true);

      // Emit event to trigger the new connection prompt (handled in AIAnalyst.tsx)
      events.emit('aiAnalystNewConnectionPrompt', connectionUuid, connectionType, connectionName);
    },
    [setShowConnectionsMenu, setShowAIAnalyst]
  );

  const onConnectionSelected: OnConnectionSelectedCallback = useCallback(
    (connectionUuid, connectionType, connectionName) => {
      // Close the connections dialog
      setShowConnectionsMenu(false);

      // Open the AI analyst panel with schema viewer
      setShowAIAnalyst(true);
      setAIAnalystActiveSchemaConnectionUuid(connectionUuid);

      // Emit event to set the connection context in AI chat
      events.emit('aiAnalystSelectConnection', connectionUuid, connectionType, connectionName);
    },
    [setShowConnectionsMenu, setShowAIAnalyst, setAIAnalystActiveSchemaConnectionUuid]
  );

  return (
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
        {showConnectionsMenu && (
          <Connections
            connections={connections}
            connectionsAreLoading={isLoading}
            teamUuid={teamUuid}
            sshPublicKey={sshPublicKey}
            staticIps={staticIps}
            initialView={initialView}
            onConnectionCreated={onConnectionCreated}
            onConnectionSelected={onConnectionSelected}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
