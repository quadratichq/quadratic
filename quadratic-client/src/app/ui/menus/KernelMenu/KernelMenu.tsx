import { editorInteractionStateTransactionsInfoAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { content } from '@/app/gridGL/pixiApp/Content';
import { getConnectionKind, getLanguage, isDatabaseConnection } from '@/app/helpers/codeCellLanguage';
import { focusGrid } from '@/app/helpers/focusGrid';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { xyToA1 } from '@/app/quadratic-core/quadratic_core';
import { SidebarToggle, SidebarTooltip } from '@/app/ui/QuadraticSidebar';
import type { CodeRun } from '@/app/web-workers/CodeRun';
import { javascriptWebWorker } from '@/app/web-workers/javascriptWebWorker/javascriptWebWorker';
import { pythonWebWorker } from '@/app/web-workers/pythonWebWorker/pythonWebWorker';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { StopCircleIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { cn } from '@/shared/shadcn/utils';
import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

// Update the KernelMenu component to accept a custom trigger
export const KernelMenu = ({ triggerIcon }: { triggerIcon: React.ReactNode }) => {
  const transactionsInfo = useRecoilValue(editorInteractionStateTransactionsInfoAtom);
  const [isOpen, setIsOpen] = useState(false);

  const [disableRunCodeCell, setDisableRunCodeCell] = useState(true);
  useEffect(() => {
    const checkRunCodeCell = () => setDisableRunCodeCell(!content.cellsSheet.tables.hasCodeCellInCurrentSelection());
    checkRunCodeCell();

    events.on('cursorPosition', checkRunCodeCell);
    return () => {
      events.off('cursorPosition', checkRunCodeCell);
    };
  }, []);

  // Store current and awaiting operations from Rust (preserves execution order)
  // Rust sends a unified event with all operations, so we don't need language-specific state
  const [currentCodeRun, setCurrentCodeRun] = useState<CodeRun | undefined>();
  const [awaitingCodeRuns, setAwaitingCodeRuns] = useState<CodeRun[]>([]);

  useEffect(() => {
    // Listen only to unified event from Rust (which has all languages combined)
    // This is the authoritative source for all pending operations from Rust transactions
    // Rust sends the complete list whenever it updates, so we don't need language-specific handlers
    const unifiedStateHandler = (current?: CodeRun, awaitingExecution?: CodeRun[]) => {
      // Rust sends the current operation directly - no need to distribute by language
      setCurrentCodeRun(current);

      // Store awaiting operations in the order Rust sends them
      if (awaitingExecution && awaitingExecution.length > 0) {
        // Remove duplicates based on sheet position while preserving order
        const uniqueAwaiting = awaitingExecution.filter((run, index, self) => {
          return (
            index ===
            self.findIndex(
              (r) =>
                r.sheetPos.x === run.sheetPos.x &&
                r.sheetPos.y === run.sheetPos.y &&
                r.sheetPos.sheetId === run.sheetPos.sheetId
            )
          );
        });
        setAwaitingCodeRuns(uniqueAwaiting);
      } else {
        setAwaitingCodeRuns([]);
      }
    };

    // Only listen to unified event from Rust - it has the complete picture
    events.on('codeRunningState', unifiedStateHandler);

    return () => {
      events.off('codeRunningState', unifiedStateHandler);
    };
  });

  const [running, setRunning] = useState(0);
  useEffect(() => {
    // Show total count of active + pending runs
    const activeCount = currentCodeRun ? 1 : 0;
    const pendingCount = awaitingCodeRuns.length;
    setRunning(activeCount + pendingCount);
  }, [currentCodeRun, awaitingCodeRuns]);

  // Helper to get code cell info
  const getCodeCellInfo = (codeRun: CodeRun) => {
    const cellsSheet = content.cellsSheets.getById(codeRun.sheetPos.sheetId);
    const codeCell = cellsSheet?.tables.getCodeCellIntersects({
      x: codeRun.sheetPos.x,
      y: codeRun.sheetPos.y,
    });
    const name = codeCell?.name || xyToA1(codeRun.sheetPos.x, codeRun.sheetPos.y);
    const language = codeCell?.language;
    const languageId = language ? getConnectionKind(language) || getLanguage(language) : undefined;
    return { name, language, languageId };
  };

  // Helper to get cancel handler for a code run
  const getCancelHandler = (codeRun: CodeRun) => {
    const { languageId } = getCodeCellInfo(codeRun);
    if (languageId === 'Formula') {
      // Formulas execute synchronously and can't be cancelled
      return () => {};
    } else if (isDatabaseConnection(languageId)) {
      return () => quadraticCore.sendCancelExecution({ Connection: {} as any });
    } else if (languageId === 'Javascript') {
      return () => javascriptWebWorker.cancelExecution();
    } else if (languageId === 'Python') {
      return () => pythonWebWorker.cancelExecution();
    } else {
      console.warn('Unhandled language in getCancelHandler', languageId);
      return () => {};
    }
  };

  // Handler to stop current code cell
  const stopCurrentCodeCell = () => {
    if (currentCodeRun) {
      getCancelHandler(currentCodeRun)();
    }
  };

  // Handler to stop all code cells (current + awaiting)
  const stopAllCodeCells = () => {
    // Cancel each queued cell individually first
    awaitingCodeRuns.forEach((codeRun) => {
      getCancelHandler(codeRun)();
    });

    // Cancel current running cell if any
    if (currentCodeRun) {
      getCancelHandler(currentCodeRun)();
    }

    // Also cancel all language workers to ensure everything is stopped
    // This restarts the workers and clears their queues
    pythonWebWorker.cancelExecution();
    javascriptWebWorker.cancelExecution();
    // Cancel connection executions
    quadraticCore.sendCancelExecution({ Connection: {} as any });
  };

  // Check if there are multiple cells running (current + awaiting, or multiple awaiting)
  const hasMultipleCellsRunning = running > 1;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <SidebarTooltip label="Spreadsheet status">
        <DropdownMenuTrigger asChild>
          <SidebarToggle pressed={isOpen} data-testid="kernel-menu">
            {triggerIcon}
            {(transactionsInfo.length > 0 || running > 0) && (
              <div
                data-testid="kernel-menu-busy"
                className={cn(
                  'pointer-events-none absolute flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-background',
                  running > 0 ? 'right-0 top-0 h-4 w-4' : 'right-1 top-1 h-2 w-2'
                )}
              >
                {running > 0 ? running : ''}
              </div>
            )}
          </SidebarToggle>
        </DropdownMenuTrigger>
      </SidebarTooltip>
      <DropdownMenuContent
        side="right"
        align="start"
        alignOffset={-16}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          focusGrid();
        }}
      >
        {(currentCodeRun || awaitingCodeRuns.length > 0) && (
          <>
            <DropdownMenuSeparator />

            {/* Currently running cell */}
            {currentCodeRun && (
              <>
                <DropdownMenuLabel>Running</DropdownMenuLabel>
                {(() => {
                  const { name, languageId } = getCodeCellInfo(currentCodeRun);
                  const sheetName =
                    currentCodeRun.sheetPos.sheetId !== sheets.current
                      ? `, "${sheets.getById(currentCodeRun.sheetPos.sheetId)?.name || ''}"`
                      : '';
                  return (
                    <DropdownMenuItem
                      key={`current-${currentCodeRun.sheetPos.sheetId}-${currentCodeRun.sheetPos.x}-${currentCodeRun.sheetPos.y}`}
                      className="pl-6 opacity-100"
                      onSelect={(e) => e.preventDefault()}
                    >
                      <div className="flex items-center gap-2 text-sm">
                        {languageId && <LanguageIcon language={languageId} className="h-4 w-4 flex-shrink-0" />}
                        <span>
                          {name}
                          {sheetName}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  );
                })()}
              </>
            )}

            {/* Awaiting execution cells */}
            {awaitingCodeRuns.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Pending ({awaitingCodeRuns.length})</DropdownMenuLabel>
                <div className="max-h-[220px] overflow-y-auto">
                  {awaitingCodeRuns.map((codeRun) => {
                    const { name, languageId } = getCodeCellInfo(codeRun);
                    const sheetName =
                      codeRun.sheetPos.sheetId !== sheets.current
                        ? `, "${sheets.getById(codeRun.sheetPos.sheetId)?.name || ''}"`
                        : '';
                    return (
                      <DropdownMenuItem
                        key={`awaiting-${codeRun.sheetPos.sheetId}-${codeRun.sheetPos.x}-${codeRun.sheetPos.y}`}
                        className="pl-6 opacity-100"
                        onSelect={(e) => e.preventDefault()}
                      >
                        <div className="flex items-center gap-2 text-sm">
                          {languageId && <LanguageIcon language={languageId} className="h-4 w-4 flex-shrink-0" />}
                          <span>
                            {name}
                            {sheetName}
                          </span>
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                </div>
                {/* Dummy item to ensure separator CSS works (separator needs neighbors on both sides) */}
                {awaitingCodeRuns.length > 0 && (
                  <DropdownMenuItem className="pointer-events-none hidden h-0 p-0" onSelect={(e) => e.preventDefault()}>
                    <span className="sr-only">Separator anchor</span>
                  </DropdownMenuItem>
                )}
              </>
            )}

            {/* Stop actions when there are running cells */}
            {(currentCodeRun || awaitingCodeRuns.length > 0) && (
              <>
                <DropdownMenuSeparator />
                {currentCodeRun && (
                  <DropdownMenuItem onClick={stopCurrentCodeCell}>
                    <div className="flex items-center gap-2 text-sm">
                      <StopCircleIcon className="flex-shrink-0 text-muted-foreground" />
                      <span>Stop running cell</span>
                    </div>
                  </DropdownMenuItem>
                )}
                {hasMultipleCellsRunning && (
                  <DropdownMenuItem onClick={stopAllCodeCells}>
                    <div className="flex items-center gap-2 text-sm">
                      <StopCircleIcon className="flex-shrink-0 text-muted-foreground" />
                      <span>Stop all running cells</span>
                    </div>
                  </DropdownMenuItem>
                )}
              </>
            )}
          </>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          disabled={disableRunCodeCell}
          onClick={() => quadraticCore.rerunCodeCells(sheets.current, sheets.sheet.cursor.a1String(), false)}
        >
          Run selected cell
          <DropdownMenuShortcut className="pl-4">
            {KeyboardSymbols.Command + KeyboardSymbols.Enter}
          </DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => quadraticCore.rerunCodeCells(sheets.current, undefined, false)}>
          Run all cells in sheet
          <DropdownMenuShortcut className="pl-4">
            {KeyboardSymbols.Shift + KeyboardSymbols.Command + KeyboardSymbols.Enter}
          </DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => quadraticCore.rerunCodeCells(undefined, undefined, false)}>
          Run all cells in file
          <DropdownMenuShortcut className="pl-4">
            {KeyboardSymbols.Shift + KeyboardSymbols.Command + KeyboardSymbols.Alt + KeyboardSymbols.Enter}
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
