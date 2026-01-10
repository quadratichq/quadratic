import { codeEditorAtom } from '@/app/atoms/codeEditorAtom';
import {
  editorInteractionStateShowCellTypeMenuAtom,
  editorInteractionStateShowConnectionsMenuAtom,
  editorInteractionStateTeamUuidAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import type { CodeCellLanguage } from '@/app/quadratic-core-types';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import '@/app/ui/styles/floating-dialog.css';
import { apiClient } from '@/shared/api/apiClient';
import { SettingsIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
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
import type { ConnectionList } from 'quadratic-shared/typesAndSchemasConnections';
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
  const setCodeEditorState = useSetRecoilState(codeEditorAtom);
  const { connections } = useConnectionsFetcher();
  const teamUuid = useRecoilValue(editorInteractionStateTeamUuidAtom);
  const {
    userMakingRequest: { teamPermissions },
  } = useFileRouteLoaderData();
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

  const manageConnections = useCallback(() => {
    setShowCellTypeMenu(false);
    setShowConnectionsMenu(true);
  }, [setShowCellTypeMenu, setShowConnectionsMenu]);

  return (
    <CommandDialog
      dialogProps={{ open: true, onOpenChange: close }}
      commandProps={{}}
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

        {teamPermissions?.includes('TEAM_EDIT') && (
          <CommandGroup heading="Connections">
            {connections.map((connection, i) => (
              <ConnectionCommandItem
                key={connection.uuid}
                connection={connection}
                teamUuid={teamUuid}
                index={i}
                onSelect={() => openEditor({ Connection: { kind: connection.type, id: connection.uuid } })}
              />
            ))}

            <CommandItemWrapper
              name="Add or manage…"
              icon={<SettingsIcon className="text-muted-foreground opacity-80" />}
              onSelect={manageConnections}
            />
          </CommandGroup>
        )}
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
  const [percentCompleted, setPercentCompleted] = useState<number | undefined>(
    connection.syncedConnectionPercentCompleted
  );

  // Poll for updated syncedConnectionPercentCompleted when the connection has sync data
  useEffect(() => {
    // Only poll if this is a synced connection
    if (connection.syncedConnectionUpdatedDate === undefined) {
      return;
    }

    const fetchConnection = async () => {
      try {
        const fetchedConnection = await apiClient.connections.get({
          connectionUuid: connection.uuid,
          teamUuid,
        });
        setPercentCompleted(fetchedConnection?.syncedConnectionPercentCompleted);
      } catch {
        // Silently fail - keep using existing percentCompleted value
      }
    };

    // Fire immediately to get fresh data
    fetchConnection();

    // Then poll every interval
    const interval = setInterval(fetchConnection, SYNCED_CONNECTION_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [connection.uuid, connection.syncedConnectionUpdatedDate, teamUuid]);

  const isDisabled = percentCompleted !== undefined && percentCompleted < 100;

  return (
    <CommandItem
      disabled={isDisabled}
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
          {isDisabled && <time className="ml-2 text-xs text-muted-foreground">(syncing, {percentCompleted}%)</time>}
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
