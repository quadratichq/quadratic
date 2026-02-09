import { aiAnalystActiveSchemaConnectionUuidAtom, showAIAnalystAtom } from '@/app/atoms/aiAnalystAtom';
import { codeEditorAtom } from '@/app/atoms/codeEditorAtom';
import {
  editorInteractionStateShowCellTypeMenuAtom,
  editorInteractionStateShowConnectionsMenuAtom,
  editorInteractionStateTeamUuidAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { deriveSyncStateFromConnectionList } from '@/app/atoms/useSyncedConnection';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { focusAIAnalyst } from '@/app/helpers/focusGrid';
import { isEmbed } from '@/app/helpers/isEmbed';
import type { CodeCellLanguage } from '@/app/quadratic-core-types';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import '@/app/ui/styles/floating-dialog.css';
import { apiClient } from '@/shared/api/apiClient';
import { AddIcon, SettingsIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { useFileRouteLoaderDataRequired } from '@/shared/hooks/useFileRouteLoaderData';
import { Badge } from '@/shared/shadcn/ui/badge';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/shared/shadcn/ui/command';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import {
  isSyncedConnectionType,
  type ConnectionList,
  type ConnectionType,
} from 'quadratic-shared/typesAndSchemasConnections';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

const SYNCED_CONNECTION_POLL_INTERVAL_MS = 10000; // 10 seconds

interface CellTypeOption {
  name: string;
  searchStrings?: string[];
  mode: CodeCellLanguage;
  icon: any;
  disabled?: boolean;
  experimental?: boolean;
}
let CELL_TYPE_OPTIONS: CellTypeOption[] = [
  {
    name: 'Python',
    mode: 'Python',
    icon: <LanguageIcon language="Python" />,
  },
  {
    name: 'Formula',
    searchStrings: ['fx', 'functions', 'formulas'],
    mode: 'Formula',
    icon: <LanguageIcon language="Formula" />,
  },
  {
    name: 'JavaScript',
    searchStrings: ['js'],
    mode: 'Javascript',
    icon: <LanguageIcon language="Javascript" />,
    experimental: false,
  },
];

export const CellTypeMenu = memo(() => {
  const [showCellTypeMenu, setShowCellTypeMenu] = useRecoilState(editorInteractionStateShowCellTypeMenuAtom);
  const setShowConnectionsMenu = useSetRecoilState(editorInteractionStateShowConnectionsMenuAtom);
  const setShowAIAnalyst = useSetRecoilState(showAIAnalystAtom);
  const setAIAnalystActiveSchemaConnectionUuid = useSetRecoilState(aiAnalystActiveSchemaConnectionUuidAtom);
  const setCodeEditorState = useSetRecoilState(codeEditorAtom);
  const { connections } = useConnectionsFetcher();
  const teamUuid = useRecoilValue(editorInteractionStateTeamUuidAtom);
  const {
    userMakingRequest: { teamPermissions },
  } = useFileRouteLoaderDataRequired();
  const includeLanguages = useMemo(() => showCellTypeMenu !== 'connections', [showCellTypeMenu]);
  const searchLabel = useMemo(() => `Choose a ${includeLanguages ? 'cell type' : 'connection'}…`, [includeLanguages]);

  useEffect(() => {
    trackEvent('[CellTypeMenu].opened');
  }, []);

  const close = useCallback(() => {
    setShowCellTypeMenu(false);
  }, [setShowCellTypeMenu]);

  const openEditor = useCallback(
    (language: CodeCellLanguage) => {
      trackEvent('[CellTypeMenu].selected', { language });

      setShowCellTypeMenu(false);

      const sheetId = sheets.current;
      const { x, y } = sheets.sheet.cursor.position;

      setCodeEditorState((prev) => ({
        ...prev,
        diffEditorContent: undefined,
        waitingForEditorClose: {
          codeCell: {
            sheetId,
            pos: { x, y },
            language,
            lastModified: 0,
          },
          showCellTypeMenu: false,
          initialCode: '',
          inlineEditor: false,
        },
      }));
    },
    [setCodeEditorState, setShowCellTypeMenu]
  );

  const addConnection = useCallback(() => {
    setShowCellTypeMenu(false);
    setShowConnectionsMenu('new');
  }, [setShowCellTypeMenu, setShowConnectionsMenu]);

  const manageConnections = useCallback(() => {
    setShowCellTypeMenu(false);
    setShowConnectionsMenu(true);
  }, [setShowCellTypeMenu, setShowConnectionsMenu]);

  const selectConnection = useCallback(
    (connectionUuid: string, connectionType: ConnectionType, connectionName: string) => {
      trackEvent('[CellTypeMenu].selectConnection', { type: connectionType });

      if (includeLanguages) {
        openEditor({ Connection: { kind: connectionType, id: connectionUuid } });
        return;
      }

      // Close the menu
      setShowCellTypeMenu(false);

      // Open the AI analyst panel with schema viewer
      setShowAIAnalyst(true);
      setAIAnalystActiveSchemaConnectionUuid(connectionUuid);

      // Emit event to set the connection context in AI chat
      events.emit('aiAnalystSelectConnection', connectionUuid, connectionType, connectionName);

      // Focus the AI analyst input
      setTimeout(focusAIAnalyst, 100);
    },
    [includeLanguages, openEditor, setShowCellTypeMenu, setShowAIAnalyst, setAIAnalystActiveSchemaConnectionUuid]
  );

  return (
    <CommandDialog
      dialogProps={{ open: true, onOpenChange: close }}
      commandProps={{
        // Custom filter to maintain DOM order when search is empty
        filter: (value, search) => {
          if (!search) return 1; // Same score for all → DOM order preserved
          return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
        },
      }}
      overlayProps={{ onPointerDown: (e) => e.preventDefault() }}
    >
      <CommandInput placeholder={searchLabel} id="CellTypeMenuInputID" />

      <CommandList id="CellTypeMenuID">
        <CommandEmpty>No results found.</CommandEmpty>

        {includeLanguages && (
          <>
            <CommandGroup heading="Languages">
              {CELL_TYPE_OPTIONS.map(({ name, disabled, experimental, icon, mode }, i) => (
                <CommandItemWrapper
                  key={name}
                  disabled={disabled}
                  icon={icon}
                  name={name}
                  badge={experimental ? 'Experimental' : ''}
                  onSelect={() => openEditor(mode)}
                />
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Connections">
          {isEmbed ? (
            <div className="px-2 py-1.5 text-sm">Only available in the full Quadratic app</div>
          ) : (
            teamPermissions?.includes('TEAM_EDIT') && (
              <>
                {connections.map((connection, i) => (
                  <ConnectionCommandItem
                    key={connection.uuid}
                    connection={connection}
                    teamUuid={teamUuid}
                    index={i}
                    onSelect={() => selectConnection(connection.uuid, connection.type, connection.name)}
                  />
                ))}

                <CommandItemWrapper
                  name="Add connection"
                  icon={<AddIcon className="text-muted-foreground opacity-80" />}
                  onSelect={addConnection}
                />
                <CommandItemWrapper
                  name="Manage connections"
                  icon={<SettingsIcon className="text-muted-foreground opacity-80" />}
                  onSelect={manageConnections}
                />
              </>
            )
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
});

interface ConnectionCommandItemProps {
  connection: ConnectionList[number];
  teamUuid: string;
  index: number;
  onSelect: () => void;
}

const ConnectionCommandItem = memo(({ connection, teamUuid, index, onSelect }: ConnectionCommandItemProps) => {
  const [syncData, setSyncData] = useState({
    percentCompleted: connection.syncedConnectionPercentCompleted,
    latestLogStatus: connection.syncedConnectionLatestLogStatus,
  });

  const isSyncedConnection = isSyncedConnectionType(connection.type);

  // Poll for updated sync data when this is a synced connection type
  useEffect(() => {
    if (!isSyncedConnection) {
      return;
    }

    const fetchConnection = async () => {
      try {
        const fetchedConnection = await apiClient.connections.get({
          connectionUuid: connection.uuid,
          teamUuid,
        });
        setSyncData({
          percentCompleted: fetchedConnection?.syncedConnectionPercentCompleted,
          latestLogStatus: fetchedConnection?.syncedConnectionLatestLogStatus,
        });
      } catch {
        // Silently fail - keep using existing sync data
      }
    };

    // Fire immediately to get fresh data
    fetchConnection();

    // Then poll every interval
    const interval = setInterval(fetchConnection, SYNCED_CONNECTION_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [connection.uuid, isSyncedConnection, teamUuid]);

  const syncState = isSyncedConnection
    ? deriveSyncStateFromConnectionList({
        syncedConnectionPercentCompleted: syncData.percentCompleted,
        syncedConnectionLatestLogStatus: syncData.latestLogStatus,
      })
    : null;

  // Disable if syncing or not yet synced
  const isSyncing = syncState === 'syncing' || syncState === 'not_synced';

  return (
    <CommandItem
      disabled={isSyncing}
      onSelect={onSelect}
      value={`${connection.name}__${index}`}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div className="mr-4 flex h-5 w-5 items-center">
        <LanguageIcon language={connection.type} />
      </div>
      <div className="flex flex-col truncate">
        <span className="flex items-center">
          {connection.name}
          {isSyncing && <span className="ml-2 text-xs text-muted-foreground">(syncing)</span>}
        </span>
      </div>
    </CommandItem>
  );
});

const CommandItemWrapper = memo(
  ({
    disabled,
    icon,
    name,
    badge,
    value,
    onSelect,
  }: {
    disabled?: boolean;
    icon: React.ReactNode;
    name: string;
    badge?: React.ReactNode;
    value?: string;
    onSelect: () => void;
  }) => {
    return (
      <CommandItem
        disabled={disabled}
        onSelect={onSelect}
        value={value ? value : name}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div className="mr-4 flex h-5 w-5 items-center">{icon}</div>
        <div className="flex flex-col truncate">
          <span className="flex items-center">
            {name}{' '}
            {badge && (
              <Badge variant="outline" className="ml-2">
                {badge}
              </Badge>
            )}
          </span>
        </div>
      </CommandItem>
    );
  }
);
