import { aiAnalystActiveSchemaConnectionUuidAtom, showAIAnalystAtom } from '@/app/atoms/aiAnalystAtom';
import { editorInteractionStateShowConnectionsMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { focusAIAnalyst } from '@/app/helpers/focusGrid';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import type { OnConnectionCreatedCallback } from '@/shared/components/connections/ConnectionForm';
import { Connections } from '@/shared/components/connections/Connections';
import { useFileRouteLoaderDataRequired } from '@/shared/hooks/useFileRouteLoaderData';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { useCallback } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';

export function ConnectionsMenu() {
  const [showConnectionsMenu, setShowConnectionsMenu] = useRecoilState(editorInteractionStateShowConnectionsMenuAtom);
  const setShowAIAnalyst = useSetRecoilState(showAIAnalystAtom);
  const setAIAnalystActiveSchemaConnectionUuid = useSetRecoilState(aiAnalystActiveSchemaConnectionUuidAtom);

  const {
    team: { uuid: teamUuid, sshPublicKey },
  } = useFileRouteLoaderDataRequired();
  const { connections, staticIps, isLoading } = useConnectionsFetcher();

  const onConnectionCreated: OnConnectionCreatedCallback = useCallback(
    (connectionUuid, connectionType, connectionName) => {
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

  const isOpen = showConnectionsMenu !== false;
  const menuState = typeof showConnectionsMenu === 'object' ? showConnectionsMenu : undefined;
  const initialView = menuState?.initialView ?? (showConnectionsMenu === true ? 'list' : undefined);
  const initialConnectionType = menuState?.initialConnectionType;
  const initialConnectionUuid = menuState?.initialConnectionUuid;

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
  );
}
