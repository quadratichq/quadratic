import type { AIToolMessageMetaData } from '@/app/ai/tools/aiToolsHelpers';
import { setCodeCellResult, waitForSetCodeCellValue } from '@/app/ai/tools/aiToolsHelpers';
import { getConnectionSchemaMarkdown, getConnectionTableInfo } from '@/app/ai/utils/aiConnectionContext';
import { sheets } from '@/app/grid/controller/Sheets';
import { ensureRectVisible } from '@/app/gridGL/interaction/viewportHelper';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { xyToA1 } from '@/app/quadratic-core/quadratic_core';
import { aiUser } from '@/app/web-workers/multiplayerWebWorker/aiUser';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { apiClient } from '@/shared/api/apiClient';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import type { AIToolsArgsSchema } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ToolResultContent } from 'quadratic-shared/typesAndSchemasAI';
import type { z } from 'zod';

type ConnectionToolActions = {
  [K in AITool.GetDatabaseSchemas]: (args: z.infer<(typeof AIToolsArgsSchema)[K]>) => Promise<ToolResultContent>;
} & {
  [K in AITool.SetSQLCodeCellValue]: (
    args: z.infer<(typeof AIToolsArgsSchema)[K]>,
    messageMetaData: AIToolMessageMetaData
  ) => Promise<ToolResultContent>;
};

export const connectionToolsActions: ConnectionToolActions = {
  [AITool.GetDatabaseSchemas]: async (args) => {
    const { connection_ids } = args;
    const connectionIds = connection_ids.filter((id) => !!id);

    // Get team UUID from the current context
    const teamUuid = pixiAppSettings.editorInteractionState.teamUuid;
    if (!teamUuid) {
      return [createTextContent('Unable to retrieve database schemas. Access to team is required.')];
    }

    // Get all team connections or specific ones
    let connections;
    try {
      const teamConnections = await apiClient.connections.list(teamUuid);
      connections =
        connectionIds.length > 0
          ? teamConnections.filter((connection) => connectionIds.includes(connection.uuid))
          : teamConnections;

      if (connections.length === 0) {
        return [
          createTextContent(
            `Error: ${connectionIds.length === 0 ? 'No database connections found for this team. Please set up database connections in the team settings first.' : 'None of the specified connection IDs were found or accessible. Make sure the connection IDs are correct. To see all available connections, call this tool with empty connection_ids array.'}`
          ),
        ];
      }
    } catch (connectionError) {
      console.warn('[GetDatabaseSchemas] Failed to fetch team connections:', connectionError);
      return [
        createTextContent(
          `Error: Unable to retrieve database connections. This could be because of network issues, please try again later. ${connectionError}`
        ),
      ];
    }

    try {
      // Get info for each connection
      const connectionsInfo = await Promise.all(
        connections.map((connection) => getConnectionTableInfo(connection, teamUuid))
      );

      // Filter out null results
      if (connectionsInfo.length === 0) {
        return [
          createTextContent(
            'No database schemas could be retrieved. All connections may be unavailable or have configuration issues.'
          ),
        ];
      }

      // Format the response
      const schemaText = connectionsInfo.map(getConnectionSchemaMarkdown).join('\n---\n\n');

      // Add connection summary for future reference
      const connectionSummary = connectionsInfo
        .filter((item) => item && !item.error)
        .map((item) => `- ${item!.connectionName} (${item!.connectionType}): ${item!.connectionId}`)
        .join('\n');

      const summaryText = connectionSummary
        ? `\n\nAvailable connection IDs for future reference:\n${connectionSummary}`
        : '';

      return [
        createTextContent(
          schemaText
            ? `Database schemas retrieved successfully:\n\n${schemaText}${summaryText}`
            : `No database schema information available.${summaryText}`
        ),
      ];
    } catch (error) {
      console.error('[GetDatabaseSchemas] Unexpected error:', error);
      return [
        createTextContent(
          `Error retrieving database schemas: ${error instanceof Error ? error.message : String(error)}`
        ),
      ];
    }
  },
  [AITool.SetSQLCodeCellValue]: async (args, messageMetaData) => {
    try {
      let { sheet_name, code_cell_name, connection_kind, code_cell_position, sql_code_string, connection_id } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
      const selection = sheets.stringToSelection(code_cell_position, sheetId);
      if (!selection.isSingleSelection(sheets.jsA1Context)) {
        return [createTextContent('Invalid code cell position, this should be a single cell, not a range')];
      }

      const { x, y } = selection.getCursor();

      // Move AI cursor to the code cell position
      try {
        const selectionString = selection.save();
        aiUser.updateSelection(selectionString, sheetId);
      } catch (e) {
        console.warn('Failed to update AI user selection:', e);
      }

      const transactionId = await quadraticCore.setCodeCellValue({
        sheetId,
        x,
        y,
        codeString: sql_code_string,
        language: {
          Connection: {
            kind: connection_kind,
            id: connection_id,
          },
        },
        codeCellName: code_cell_name,
        isAi: true,
      });

      if (transactionId) {
        await waitForSetCodeCellValue(transactionId);

        // After execution, adjust viewport and cursor to show full output if it exists
        const tableCodeCell = content.cellsSheets.getById(sheetId)?.tables.getCodeCellIntersects({ x, y });
        if (tableCodeCell) {
          const width = tableCodeCell.w;
          const height = tableCodeCell.h;
          ensureRectVisible(sheetId, { x, y }, { x: x + width - 1, y: y + height - 1 });

          // Update AI cursor to show selection over entire output area
          if (width > 1 || height > 1) {
            try {
              const endX = x + width - 1;
              const endY = y + height - 1;
              const rangeSelection = `${xyToA1(x, y)}:${xyToA1(endX, endY)}`;
              const jsSelection = sheets.stringToSelection(rangeSelection, sheetId);
              const selectionString = jsSelection.save();
              aiUser.updateSelection(selectionString, sheetId);
            } catch (e) {
              console.warn('Failed to update AI user selection to full output range:', e);
            }
          }
        }

        const result = await setCodeCellResult(sheetId, x, y, messageMetaData);
        return result;
      } else {
        return [createTextContent('Error executing set sql code cell value tool')];
      }
    } catch (e) {
      return [createTextContent(`Error executing set sql code cell value tool: ${e}`)];
    }
  },
} as const;
