import { events } from '@/app/events/events';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { apiClient } from '@/shared/api/apiClient';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import type { AITool, AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AISource, ToolResultContent } from 'quadratic-shared/typesAndSchemasAI';

export const waitForSetCodeCellValue = (transactionId: string) => {
  return new Promise((resolve) => {
    const isTransactionRunning = pixiAppSettings.editorInteractionState.transactionsInfo.some(
      (t) => t.transactionId === transactionId
    );
    if (!isTransactionRunning) {
      resolve(undefined);
    } else {
      events.once('transactionEndUpdated', (transactionInfoId) => {
        if (transactionInfoId === transactionId) {
          resolve(undefined);
        } else {
          waitForSetCodeCellValue(transactionId).then(resolve);
        }
      });
    }
  });
};

export const setCodeCellResult = async (
  sheetId: string,
  x: number,
  y: number,
  messageMetaData: AIToolMessageMetaData
): Promise<ToolResultContent> => {
  const tableCodeCell = content.cellsSheets.getById(sheetId)?.tables.getCodeCellIntersects({ x, y });
  const codeCell = tableCodeCell
    ? await quadraticCore.getCodeCell(sheetId, tableCodeCell.x, tableCodeCell.y)
    : undefined;
  if (!tableCodeCell || !codeCell) {
    return [createTextContent('Error executing set code cell value tool')];
  }

  if (codeCell.std_err || codeCell.spill_error) {
    // log code run error in analytics, if enabled
    const aiAnalyticsSettings = pixiAppSettings.editorInteractionState.settings.analyticsAi;
    if (aiAnalyticsSettings && !!messageMetaData.chatId && messageMetaData.messageIndex >= 0) {
      const codeRunError = JSON.stringify({
        code_string: codeCell.code_string,
        std_err: codeCell.std_err,
        spill_error: codeCell.spill_error,
      });
      apiClient.ai.codeRunError({
        chatId: messageMetaData.chatId,
        messageIndex: messageMetaData.messageIndex,
        codeRunError,
      });
    }
  }

  // Build console output prefix if there's any stdout
  const consoleOutput = codeCell.std_out ? `Console output:\n\`\`\`\n${codeCell.std_out}\n\`\`\`\n\n` : '';

  if (codeCell.std_err) {
    return [
      createTextContent(
        `${consoleOutput}The code cell run has resulted in an error:
\`\`\`
${codeCell.std_err}
\`\`\`
Think and reason about the error and try to fix it. Do not attempt the same fix repeatedly. If it failed once, it will fail again.
`
      ),
    ];
  }

  if (codeCell.spill_error) {
    return [
      createTextContent(
        `${consoleOutput}The code cell has spilled, because the output overlaps with existing data on the sheet.
Output size when not spilled will be ${tableCodeCell.w} cells wide and ${tableCodeCell.h} cells high.\n
Use the move tool to move just the single cell position of the code you attempted to place to a new position.\n
This should be a single cell, not a range. E.g. if you're moving the code cell you placed at C1 to G1 then you should move to G1:G1.\n
Move the code cell to a new position that will avoid spilling. Make sure the new position is not overlapping with existing data on the sheet. Do not attempt the same location repeatedly. Attempt new locations until the spill is resolved.
`
      ),
    ];
  }

  if (tableCodeCell.is_html) {
    return [
      createTextContent(`${consoleOutput}Executed set code cell value tool successfully to create a plotly chart.`),
    ];
  } else if (tableCodeCell.is_html_image) {
    return [
      createTextContent(`${consoleOutput}Executed set code cell value tool successfully to create a javascript chart.`),
    ];
  }

  // single cell output
  if (tableCodeCell.w === 1 && tableCodeCell.h === 1) {
    const singleCell = await quadraticCore.getCellValue(sheetId, x, y);
    if (singleCell === undefined || singleCell.value === '') {
      return [
        createTextContent(
          `${consoleOutput}You returned a single empty cell. Was this on purpose? If not, you may have mistakenly not put what you want to return as the last line of code. It cannot be nested in a conditional. If you used if-else or try-catch, delete the conditionals unless the user explicitly asked for them. It must be outside all functions or conditionals as the very last line of code.`
        ),
      ];
    }
    return [createTextContent(`${consoleOutput}Output is: ${singleCell.value}`)];
  }

  // multiple cell output
  return [
    createTextContent(
      `${consoleOutput}Output size is ${tableCodeCell.w} cells wide and ${tableCodeCell.h} cells high.`
    ),
  ];
};

export type AIToolMessageMetaData = {
  source: AISource;
  chatId: string;
  messageIndex: number;
};

export type AIToolActionsRecord = {
  [K in AITool]: (args: AIToolsArgs[K], messageMetaData: AIToolMessageMetaData) => Promise<ToolResultContent>;
};
