import { aiAnalystActiveSchemaConnectionUuidAtom, showAIAnalystAtom } from '@/app/atoms/aiAnalystAtom';
import { editorInteractionStateShowConnectionsMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { focusAIAnalyst } from '@/app/helpers/focusGrid';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import {
  ConnectionFormCreate,
  ConnectionFormEdit,
  type OnConnectionCreatedCallback,
} from '@/shared/components/connections/ConnectionForm';
import { connectionsByType } from '@/shared/components/connections/connectionsByType';
import { ConnectionsProvider } from '@/shared/components/connections/ConnectionsContext';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
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
  const { staticIps } = useConnectionsFetcher();

  const close = useCallback(() => {
    setShowConnectionsMenu(undefined);
  }, [setShowConnectionsMenu]);

  const onConnectionCreated: OnConnectionCreatedCallback = useCallback(
    (connectionUuid, connectionType, connectionName) => {
      close();
      setShowAIAnalyst(true);
      setAIAnalystActiveSchemaConnectionUuid(connectionUuid);
      events.emit('aiAnalystSelectConnection', connectionUuid, connectionType, connectionName);
      focusAIAnalyst();
    },
    [close, setShowAIAnalyst, setAIAnalystActiveSchemaConnectionUuid]
  );

  const isOpen = showConnectionsMenu !== undefined;
  const connectionType = showConnectionsMenu?.connectionType;
  const connectionUuid =
    showConnectionsMenu && 'connectionUuid' in showConnectionsMenu ? showConnectionsMenu.connectionUuid : undefined;
  const isEdit = !!connectionUuid;

  const connectionTypeInfo = connectionType ? connectionsByType[connectionType] : undefined;
  const title = connectionTypeInfo ? `${isEdit ? 'Edit' : 'Create'} ${connectionTypeInfo.name} connection` : '';

  return (
    <Dialog open={isOpen} onOpenChange={close}>
      <DialogContent
        className="max-w-xl"
        onPointerDownOutside={(event) => {
          event.preventDefault();
        }}
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LanguageIcon language={connectionType} className="mr-1" />
            {title}
          </DialogTitle>
        </DialogHeader>
        {isOpen && connectionType && (
          <ConnectionsProvider sshPublicKey={sshPublicKey} staticIps={staticIps ?? []}>
            {isEdit ? (
              <ConnectionFormEdit
                connectionUuid={connectionUuid}
                connectionType={connectionType}
                onClose={close}
                teamUuid={teamUuid}
              />
            ) : (
              <ConnectionFormCreate
                teamUuid={teamUuid}
                type={connectionType}
                onClose={close}
                onCancel={close}
                onConnectionCreated={onConnectionCreated}
              />
            )}
          </ConnectionsProvider>
        )}
      </DialogContent>
    </Dialog>
  );
}
