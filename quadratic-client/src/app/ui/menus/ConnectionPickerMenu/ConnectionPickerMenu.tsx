import { aiAnalystActiveSchemaConnectionUuidAtom, showAIAnalystAtom } from '@/app/atoms/aiAnalystAtom';
import { codeEditorAtom } from '@/app/atoms/codeEditorAtom';
import { type ConnectionPickerMode, connectionPickerModeAtom } from '@/app/atoms/connectionPickerAtom';
import { editorInteractionStateShowConnectionsMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { getConnectionSyncInfo } from '@/app/atoms/useSyncedConnection';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { focusAIAnalyst } from '@/app/helpers/focusGrid';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { ConnectionIcon } from '@/shared/components/ConnectionIcon';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/shadcn/ui/command';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import type { ConnectionList, ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { memo, useCallback } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';

const PICKER_PLACEHOLDERS: Record<Exclude<ConnectionPickerMode, false>, string> = {
  query: 'Query a connection…',
  prompt: 'Prompt a connection…',
  manage: 'Manage a connection…',
};

export const ConnectionPickerMenu = memo(() => {
  const [mode, setMode] = useRecoilState(connectionPickerModeAtom);
  const { connections } = useConnectionsFetcher();
  const setCodeEditorState = useSetRecoilState(codeEditorAtom);
  const setShowAIAnalyst = useSetRecoilState(showAIAnalystAtom);
  const setActiveConnectionId = useSetRecoilState(aiAnalystActiveSchemaConnectionUuidAtom);
  const setShowConnectionsMenu = useSetRecoilState(editorInteractionStateShowConnectionsMenuAtom);

  const close = useCallback(() => setMode(false), [setMode]);

  const handleSelect = useCallback(
    (connectionUuid: string, connectionType: ConnectionType, connectionName: string) => {
      const currentMode = mode;
      close();

      switch (currentMode) {
        case 'query': {
          trackEvent('[ConnectionPicker].query', { type: connectionType });
          const sheetId = sheets.current;
          const { x, y } = sheets.sheet.cursor.position;
          setCodeEditorState((prev) => ({
            ...prev,
            diffEditorContent: undefined,
            waitingForEditorClose: {
              codeCell: {
                sheetId,
                pos: { x, y },
                language: { Connection: { kind: connectionType, id: connectionUuid } },
                lastModified: 0,
              },
              showCellTypeMenu: false,
              initialCode: '',
              inlineEditor: false,
            },
          }));
          break;
        }
        case 'prompt': {
          trackEvent('[ConnectionPicker].prompt', { type: connectionType });
          setShowAIAnalyst(true);
          setActiveConnectionId(connectionUuid);
          events.emit('aiAnalystSelectConnection', connectionUuid, connectionType, connectionName);
          focusAIAnalyst();
          break;
        }
        case 'manage': {
          trackEvent('[ConnectionPicker].manage', { type: connectionType });
          setShowConnectionsMenu({ connectionUuid, connectionType });
          break;
        }
      }
    },
    [close, mode, setCodeEditorState, setShowAIAnalyst, setActiveConnectionId, setShowConnectionsMenu]
  );

  if (!mode) return null;

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
      <CommandInput placeholder={PICKER_PLACEHOLDERS[mode]} />
      <CommandList>
        <CommandEmpty>No connections found.</CommandEmpty>
        <CommandGroup heading="Connections">
          {connections.map((connection, i) => (
            <ConnectionPickerItem
              key={connection.uuid}
              connection={connection}
              index={i}
              onSelect={() => handleSelect(connection.uuid, connection.type, connection.name)}
            />
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
});

const ConnectionPickerItem = memo(
  ({ connection, index, onSelect }: { connection: ConnectionList[number]; index: number; onSelect: () => void }) => {
    const { syncState } = getConnectionSyncInfo(connection);

    return (
      <CommandItem
        onSelect={onSelect}
        value={`${connection.name}__${index}`}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div className="mr-4 flex h-5 w-5 items-center">
          <ConnectionIcon type={connection.type} syncState={syncState} />
        </div>
        <div className="flex flex-col truncate">{connection.name}</div>
      </CommandItem>
    );
  }
);
