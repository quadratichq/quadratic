import { aiAnalystActiveSchemaConnectionUuidAtom, showAIAnalystAtom } from '@/app/atoms/aiAnalystAtom';
import {
  editorInteractionStateShowConnectionsMenuAtom,
  editorInteractionStateTeamUuidAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { focusAIAnalyst } from '@/app/helpers/focusGrid';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import * as Sentry from '@sentry/react';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { useCallback, useRef } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

/**
 * Shared hook for connection dropdown menus (sidebar and AI prompt).
 *
 * Provides handlers for selecting, adding, and managing connections,
 * plus the active connection state for highlighting in the menu.
 *
 * Selecting a connection will:
 * 1. Open the AI panel (if not already open)
 * 2. Set the connection as context in the AI chat
 * 3. Open the schema viewer for that connection
 *
 * Clicking the same connection again will unselect it.
 */
export function useConnectionsDropdownHandlers(trackingPrefix: string) {
  const { connections } = useConnectionsFetcher();
  const teamUuid = useRecoilValue(editorInteractionStateTeamUuidAtom);
  const [activeConnectionId, setActiveConnectionId] = useRecoilState(aiAnalystActiveSchemaConnectionUuidAtom);
  const setShowAIAnalyst = useSetRecoilState(showAIAnalystAtom);
  const setShowConnectionsMenu = useSetRecoilState(editorInteractionStateShowConnectionsMenuAtom);

  // Track whether a connection was just selected, so callers can adjust
  // focus behavior in onCloseAutoFocus (e.g. focus AI analyst vs. grid).
  // Use didSelectConnection() to check and automatically reset the flag.
  const selectedConnectionRef = useRef(false);
  const didSelectConnection = useCallback(() => {
    if (selectedConnectionRef.current) {
      selectedConnectionRef.current = false;
      return true;
    }
    return false;
  }, []);

  const handleSelectConnection = useCallback(
    (connectionUuid: string, connectionType: ConnectionType, connectionName: string) => {
      // Toggle: if same connection, unselect it
      if (activeConnectionId === connectionUuid) {
        trackEvent(`[${trackingPrefix}].unselectConnection`);
        setActiveConnectionId(undefined);
        events.emit('aiAnalystUnselectConnection');
        return;
      }

      // Verify connection exists in local state
      const connection = connections.find((c) => c.uuid === connectionUuid);
      if (connection === undefined) {
        Sentry.captureException(new Error('A connection that was picked in the UI is not stored in local state.'));
        return;
      }

      selectedConnectionRef.current = true;
      trackEvent(`[${trackingPrefix}].selectConnection`, { language: connectionType });

      // Open the AI panel
      setShowAIAnalyst(true);

      // Open the schema viewer for this connection
      setActiveConnectionId(connectionUuid);

      // Add the connection as context in AI chat (without auto-submitting a prompt)
      events.emit('aiAnalystSelectConnection', connectionUuid, connectionType, connectionName);

      // Focus the AI analyst input (waits for panel to render if needed)
      focusAIAnalyst();
    },
    [activeConnectionId, connections, setActiveConnectionId, setShowAIAnalyst, trackingPrefix]
  );

  const handleAddConnection = useCallback(
    (type: ConnectionType) => {
      trackEvent(`[${trackingPrefix}].addConnection`, { type });
    },
    [trackingPrefix]
  );

  const handleManageConnections = useCallback(() => {
    trackEvent(`[${trackingPrefix}].manageConnections`);
    setShowConnectionsMenu(true);
  }, [setShowConnectionsMenu, trackingPrefix]);

  return {
    connections,
    teamUuid,
    activeConnectionId,
    didSelectConnection,
    handleSelectConnection,
    handleAddConnection,
    handleManageConnections,
  };
}
