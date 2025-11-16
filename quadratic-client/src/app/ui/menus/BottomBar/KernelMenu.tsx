import { editorInteractionStateTransactionsInfoAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { content } from '@/app/gridGL/pixiApp/Content';
import { getConnectionKind, getLanguage } from '@/app/helpers/codeCellLanguage';
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

  // Track state from all language sources
  const [pythonCurrent, setPythonCurrent] = useState<CodeRun | undefined>();
  const [pythonAwaiting, setPythonAwaiting] = useState<CodeRun[]>([]);
  const [javascriptCurrent, setJavascriptCurrent] = useState<CodeRun | undefined>();
  const [javascriptAwaiting, setJavascriptAwaiting] = useState<CodeRun[]>([]);
  const [connectionCurrent, setConnectionCurrent] = useState<CodeRun | undefined>();
  const [connectionAwaiting, setConnectionAwaiting] = useState<CodeRun[]>([]);

  // Combine all language states
  const currentCodeRun = pythonCurrent || javascriptCurrent || connectionCurrent;
  const awaitingCodeRuns = [
    ...(pythonAwaiting || []),
    ...(javascriptAwaiting || []),
    ...(connectionAwaiting || []),
  ].filter((run, index, self) => {
    // Remove duplicates based on sheet position
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

  useEffect(() => {
    // Listen only to unified event from Rust (which has all languages combined)
    // This is the authoritative source for all pending operations from Rust transactions
    // Rust sends the complete list whenever it updates, so we don't need language-specific handlers
    const unifiedStateHandler = (current?: CodeRun, awaitingExecution?: CodeRun[]) => {
      // Clear current runs if not in unified event
      if (!current) {
        setPythonCurrent(undefined);
        setJavascriptCurrent(undefined);
        setConnectionCurrent(undefined);
      } else {
        // Distribute current cell to appropriate language bucket
        const cellsSheet = content.cellsSheets.getById(current.sheetPos.sheetId);
        const codeCell = cellsSheet?.tables.getCodeCellIntersects({
          x: current.sheetPos.x,
          y: current.sheetPos.y,
        });
        const lang = codeCell?.language
          ? getConnectionKind(codeCell.language) || getLanguage(codeCell.language)
          : pythonWebWorker.state === 'running'
            ? 'Python'
            : javascriptWebWorker.state === 'running'
              ? 'Javascript'
              : 'Connection';

        // Set current for the appropriate language and clear others
        if (lang === 'Python') {
          setPythonCurrent(current);
          setJavascriptCurrent(undefined);
          setConnectionCurrent(undefined);
        } else if (lang === 'Javascript') {
          setPythonCurrent(undefined);
          setJavascriptCurrent(current);
          setConnectionCurrent(undefined);
        } else {
          setPythonCurrent(undefined);
          setJavascriptCurrent(undefined);
          setConnectionCurrent(current);
        }
      }

      // Distribute awaiting cells - REPLACE (not merge) to ensure we show all cells from unified event
      // IMPORTANT: Show ALL operations from Rust, even if language detection fails
      const pythonAwaiting: CodeRun[] = [];
      const javascriptAwaiting: CodeRun[] = [];
      const connectionAwaiting: CodeRun[] = [];

      if (awaitingExecution && awaitingExecution.length > 0) {
        awaitingExecution.forEach((run) => {
          const cellsSheet = content.cellsSheets.getById(run.sheetPos.sheetId);
          const codeCell = cellsSheet?.tables.getCodeCellIntersects({
            x: run.sheetPos.x,
            y: run.sheetPos.y,
          });
          const lang = codeCell?.language
            ? getConnectionKind(codeCell.language) || getLanguage(codeCell.language)
            : undefined;

          // Distribute to appropriate bucket - default to connection if language can't be determined
          // This ensures ALL operations are shown, even if language detection fails
          if (lang === 'Python') {
            pythonAwaiting.push(run);
          } else if (lang === 'Javascript') {
            javascriptAwaiting.push(run);
          } else {
            // Connection or unknown language - show it anyway
            connectionAwaiting.push(run);
          }
        });
      }

      // Replace awaiting arrays (don't merge - unified event is authoritative)
      // This ensures we show the complete list from Rust
      setPythonAwaiting(pythonAwaiting);
      setJavascriptAwaiting(javascriptAwaiting);
      setConnectionAwaiting(connectionAwaiting);
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
    if (
      languageId === 'Connection' ||
      (languageId &&
        [
          'POSTGRES',
          'MYSQL',
          'MSSQL',
          'SNOWFLAKE',
          'COCKROACHDB',
          'BIGQUERY',
          'MARIADB',
          'SUPABASE',
          'NEON',
          'MIXPANEL',
        ].includes(languageId))
    ) {
      return () => quadraticCore.sendCancelExecution({ Connection: {} as any });
    } else if (languageId === 'Javascript') {
      return () => javascriptWebWorker.cancelExecution();
    } else {
      return () => pythonWebWorker.cancelExecution();
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
  const totalRunningCells = (currentCodeRun ? 1 : 0) + awaitingCodeRuns.length;
  const hasMultipleCellsRunning = totalRunningCells > 1;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <SidebarTooltip label="Kernel">
        <DropdownMenuTrigger asChild>
          <SidebarToggle pressed={isOpen}>
            {triggerIcon}
            {(transactionsInfo.length > 0 || running > 0) && (
              <div
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
            {currentCodeRun &&
              (() => {
                const { name, languageId } = getCodeCellInfo(currentCodeRun);
                const sheetName =
                  currentCodeRun.sheetPos.sheetId !== sheets.current
                    ? `, "${sheets.getById(currentCodeRun.sheetPos.sheetId)?.name || ''}"`
                    : '';
                return (
                  <DropdownMenuItem
                    key={`current-${currentCodeRun.sheetPos.x}-${currentCodeRun.sheetPos.y}`}
                    className="opacity-100"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <div className="flex items-center gap-2 text-sm">
                      {languageId && <LanguageIcon language={languageId} className="h-4 w-4 flex-shrink-0" />}
                      <span>
                        {name}
                        {sheetName} is running...
                      </span>
                    </div>
                  </DropdownMenuItem>
                );
              })()}

            {/* Awaiting execution cells */}
            {awaitingCodeRuns.map((codeRun) => {
              const { name, languageId } = getCodeCellInfo(codeRun);
              const sheetName =
                codeRun.sheetPos.sheetId !== sheets.current
                  ? `, "${sheets.getById(codeRun.sheetPos.sheetId)?.name || ''}"`
                  : '';
              return (
                <DropdownMenuItem
                  key={`awaiting-${codeRun.sheetPos.x}-${codeRun.sheetPos.y}`}
                  onClick={getCancelHandler(codeRun)}
                  className="opacity-60"
                >
                  <div className="flex items-center gap-2 text-sm">
                    {languageId && <LanguageIcon language={languageId} className="h-4 w-4 flex-shrink-0" />}
                    <span>
                      {name}
                      {sheetName} is queued...
                    </span>
                  </div>
                </DropdownMenuItem>
              );
            })}

            {/* Stop actions when there are running cells */}
            {(currentCodeRun || awaitingCodeRuns.length > 0) && (
              <>
                <DropdownMenuSeparator />
                {currentCodeRun && (
                  <DropdownMenuItem onClick={stopCurrentCodeCell}>
                    <div className="flex items-center gap-2 text-sm">
                      <StopCircleIcon className="flex-shrink-0 text-muted-foreground" />
                      <span>Stop current code cell</span>
                    </div>
                  </DropdownMenuItem>
                )}
                {hasMultipleCellsRunning && (
                  <DropdownMenuItem onClick={stopAllCodeCells}>
                    <div className="flex items-center gap-2 text-sm">
                      <StopCircleIcon className="flex-shrink-0 text-muted-foreground" />
                      <span>Stop all code cells</span>
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
          Run selected code
          <DropdownMenuShortcut className="pl-4">
            {KeyboardSymbols.Command + KeyboardSymbols.Enter}
          </DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => quadraticCore.rerunCodeCells(sheets.current, undefined, false)}>
          Run all code in sheet
          <DropdownMenuShortcut className="pl-4">
            {KeyboardSymbols.Shift + KeyboardSymbols.Command + KeyboardSymbols.Enter}
          </DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => quadraticCore.rerunCodeCells(undefined, undefined, false)}>
          Run all code in file
          <DropdownMenuShortcut className="pl-4">
            {KeyboardSymbols.Shift + KeyboardSymbols.Command + KeyboardSymbols.Alt + KeyboardSymbols.Enter}
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
