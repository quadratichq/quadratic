import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { codeEditorAtom } from '@/app/atoms/codeEditorAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import type { JsCoordinate } from '@/app/quadratic-core-types';
import { stringToSelection } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { LanguageIcon } from '@/app/ui/components/LanguageIcon';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { CodeIcon, SaveAndRunIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { useEffect, useMemo, useState } from 'react';
import { useRecoilCallback } from 'recoil';
import type { z } from 'zod';

type SetCodeCellValueResponse = z.infer<(typeof aiToolsSpec)[AITool.SetCodeCellValue]['responseSchema']>;

type SetCodeCellValueProps = {
  args: string;
  loading: boolean;
};

// Find a unique table name that doesn't already exist in the sheet
const findUniqueName = (baseName: string): string => {
  // Start with the base name and incrementally try different names until
  // we find one that doesn't exist in the current sheet

  try {
    // Try the base name first
    return baseName;
  } catch (e) {
    // If there's an error, likely due to duplicate name, try with numbers
    console.log(`[SetCodeCellValue] Name ${baseName} already exists, trying with suffix`);

    let counter = 1;
    let newName = `${baseName}${counter}`;

    // Try a few times with increasing numbers
    while (counter < 100) {
      try {
        return newName;
      } catch (e) {
        counter++;
        newName = `${baseName}${counter}`;
      }
    }

    // If we reach here, return the original with a timestamp
    const timestamp = Date.now().toString().slice(-4);
    return `${baseName}_${timestamp}`;
  }
};

export const SetCodeCellValue = ({ args, loading }: SetCodeCellValueProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<SetCodeCellValueResponse, SetCodeCellValueResponse>>();
  const [codeCellPos, setCodeCellPos] = useState<JsCoordinate | undefined>();

  // Process arguments - similar approach to AddDataTable component
  useEffect(() => {
    if (!loading) {
      try {
        const json = JSON.parse(args);
        console.log('[SetCodeCellValue] Parsed args:', json);
        setToolArgs(aiToolsSpec[AITool.SetCodeCellValue].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[SetCodeCellValue] Failed to parse args: ', error);
      }
    }
  }, [args, loading]);

  // Extract position when toolArgs changes
  useEffect(() => {
    if (toolArgs?.success) {
      try {
        const selection = stringToSelection(toolArgs.data.code_cell_position, sheets.current, sheets.a1Context);
        const { x, y } = selection.getCursor();
        setCodeCellPos({ x, y });
      } catch (error) {
        console.error('[SetCodeCellValue] Failed to parse position: ', error);
      }
    }
  }, [toolArgs]);

  const openDiffInEditor = useRecoilCallback(
    ({ set }) =>
      (toolArgs: SetCodeCellValueResponse) => {
        if (!codeCellPos) {
          return;
        }

        set(codeEditorAtom, (prev) => ({
          ...prev,
          diffEditorContent: { editorContent: toolArgs.code_string, isApplied: false },
          waitingForEditorClose: {
            codeCell: {
              sheetId: sheets.current,
              pos: codeCellPos,
              language: toolArgs.code_cell_language,
            },
            showCellTypeMenu: false,
            inlineEditor: false,
            initialCode: '',
          },
        }));
      },
    [codeCellPos]
  );

  // Wait for a transaction to complete
  const waitForSetCodeCellValue = (transactionId: string) => {
    return new Promise<void>((resolve) => {
      const checkTransactionStatus = () => {
        const isRunning = pixiAppSettings.editorInteractionState.transactionsInfo.some(
          (t: { transactionId: string }) => t.transactionId === transactionId
        );
        if (!isRunning) {
          resolve();
        } else {
          events.once('transactionEnd', (transactionEnd) => {
            if (transactionEnd.transactionId === transactionId) {
              resolve();
            } else {
              waitForSetCodeCellValue(transactionId).then(resolve);
            }
          });
        }
      };
      checkTransactionStatus();
    });
  };

  const saveAndRun = useRecoilCallback(
    () => async (toolArgs: SetCodeCellValueResponse) => {
      if (!codeCellPos) {
        console.error('[SetCodeCellValue] Cannot save - no code cell position');
        return;
      }

      console.log('[SetCodeCellValue] Saving code cell with args:', {
        ...toolArgs,
        position: codeCellPos,
        cell_name: toolArgs.cell_name,
      });

      // Create the code cell
      const transactionId = await quadraticCore.setCodeCellValue({
        sheetId: sheets.current,
        x: codeCellPos.x,
        y: codeCellPos.y,
        codeString: toolArgs.code_string,
        language: toolArgs.code_cell_language,
        cursor: sheets.getCursorPosition(),
      });

      console.log('[SetCodeCellValue] Created code cell, transaction ID:', transactionId);

      if (transactionId) {
        // Wait for the transaction to complete before setting the name
        await waitForSetCodeCellValue(transactionId);
        console.log('[SetCodeCellValue] Transaction completed');

        // Always set the name after creating the code cell
        // First try using provided cell_name, then fall back to language-based name
        const cellName = toolArgs.cell_name ? toolArgs.cell_name : `${toolArgs.code_cell_language}Code`;
        console.log('[SetCodeCellValue] DIRECT NAME VALUE IN COMPONENT:', {
          providedCellName: toolArgs.cell_name,
          finalNameToSet: cellName,
          toolArgsData: toolArgs,
        });

        // This is an important cell to find and name after creation
        const checkAndNameCell = async () => {
          try {
            // Get a reference to the table after creation
            const table = pixiApp.cellsSheets
              .getById(sheets.current)
              ?.tables.getTableFromTableCell(codeCellPos.x, codeCellPos.y);
            console.log('[SetCodeCellValue] COMPONENT Found table after create:', {
              exists: !!table,
              name: table?.name,
              hasName: !!table?.name,
            });

            if (table) {
              // Generate a unique name based on the requested name
              const uniqueName = findUniqueName(cellName);

              // Set the name directly using dataTableMeta
              await quadraticCore.dataTableMeta(
                sheets.current,
                codeCellPos.x,
                codeCellPos.y,
                {
                  name: uniqueName,
                  showName: true,
                },
                sheets.getCursorPosition()
              );
              console.log('[SetCodeCellValue] COMPONENT Successfully set cell name to:', uniqueName);
            }
          } catch (error) {
            console.error('[SetCodeCellValue] COMPONENT Error setting cell name:', error);
          }
        };

        // Call immediately and then with increasing delays to ensure it's set
        checkAndNameCell();

        // Try again after short delay
        setTimeout(() => {
          checkAndNameCell();

          // And again after a longer delay
          setTimeout(checkAndNameCell, 500);
        }, 200);
      } else {
        console.error('[SetCodeCellValue] Failed to create code cell - no transaction ID');
      }
    },
    [codeCellPos]
  );

  const estimatedNumberOfLines = useMemo(() => {
    if (toolArgs?.success) {
      return toolArgs.data.code_string.split('\n').length;
    } else {
      return args.split('\\n').length;
    }
  }, [toolArgs, args]);

  // Loading state - similar to AddDataTable component
  if (loading) {
    const icon = <LanguageIcon language="" className="text-primary" />;
    const label = 'Code';
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  // Error state
  if (!!toolArgs && !toolArgs.success) {
    return <ToolCard icon={<LanguageIcon language="" />} label="Code" hasError />;
  } else if (!toolArgs || !toolArgs.data) {
    return <ToolCard isLoading />;
  }

  // Success state - extract data from toolArgs
  const { code_cell_language, code_cell_position, cell_name } = toolArgs.data;
  const icon = <LanguageIcon language={code_cell_language} />;

  return (
    <ToolCard
      icon={icon}
      label={
        <span>
          {code_cell_language} {cell_name && <span className="text-muted-foreground">| {cell_name}</span>}
        </span>
      }
      description={
        `${estimatedNumberOfLines} line` + (estimatedNumberOfLines === 1 ? '' : 's') + ` at ${code_cell_position}`
      }
      actions={
        codeCellPos ? (
          <div className="flex gap-1">
            <TooltipPopover label={'Open diff in editor'}>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => openDiffInEditor(toolArgs.data)}
                disabled={!codeCellPos}
              >
                <CodeIcon />
              </Button>
            </TooltipPopover>

            <TooltipPopover label={'Apply'}>
              <Button size="icon-sm" variant="ghost" onClick={() => saveAndRun(toolArgs.data)} disabled={!codeCellPos}>
                <SaveAndRunIcon />
              </Button>
            </TooltipPopover>
          </div>
        ) : undefined
      }
    />
  );
};
