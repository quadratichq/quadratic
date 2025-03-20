import { editorInteractionStateTransactionsInfoAtom } from '@/app/atoms/editorInteractionStateAtom';
import { usePythonState } from '@/app/atoms/usePythonState';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { focusGrid } from '@/app/helpers/focusGrid';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { xyToA1 } from '@/app/quadratic-rust-client/quadratic_rust_client';
import type { TransactionInfo } from '@/app/shared/types/transactionInfo';
import { colors } from '@/app/theme/colors';
import { SidebarToggle, SidebarTooltip } from '@/app/ui/QuadraticSidebar';
import type { CodeRun } from '@/app/web-workers/CodeRun';
import { javascriptWebWorker } from '@/app/web-workers/javascriptWebWorker/javascriptWebWorker';
import type { LanguageState } from '@/app/web-workers/languageTypes';
import { pythonWebWorker } from '@/app/web-workers/pythonWebWorker/pythonWebWorker';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { Tooltip, TooltipContent } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import StopIcon from '@mui/icons-material/Stop';
import { TooltipTrigger } from '@radix-ui/react-tooltip';
import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';

// Update the KernelMenu component to accept a custom trigger
export const KernelMenu = ({ triggerIcon }: { triggerIcon: React.ReactNode }) => {
  const [transactionsInfo, setTransactionsInfo] = useRecoilState(editorInteractionStateTransactionsInfoAtom);
  useEffect(() => {
    const handleTransactionStart = (transaction: TransactionInfo) => {
      setTransactionsInfo((prev) => [
        ...prev.filter((t) => t.transactionId !== transaction.transactionId),
        transaction,
      ]);
    };
    events.on('transactionStart', handleTransactionStart);

    const handleTransactionEnd = (transaction: TransactionInfo) => {
      setTransactionsInfo((prev) => prev.filter((t) => t.transactionId !== transaction.transactionId));
    };
    events.on('transactionEnd', handleTransactionEnd);
    return () => {
      events.off('transactionStart', handleTransactionStart);
      events.off('transactionEnd', handleTransactionEnd);
    };
  }, [setTransactionsInfo]);

  const [disableRunCodeCell, setDisableRunCodeCell] = useState(true);
  useEffect(() => {
    const checkRunCodeCell = () => setDisableRunCodeCell(!pixiApp.isCursorOnCodeCell());
    checkRunCodeCell();

    events.on('cursorPosition', checkRunCodeCell);
    return () => {
      events.off('cursorPosition', checkRunCodeCell);
    };
  }, []);

  const pythonState = usePythonState();

  const [pythonCodeRunning, setPythonCodeRunning] = useState<CodeRun | undefined>();
  useEffect(() => {
    const pythonState = (_state: LanguageState, current?: CodeRun, _awaitingExecution?: CodeRun[]) => {
      setPythonCodeRunning(current);
    };
    events.on('pythonState', pythonState);
    return () => {
      events.off('pythonState', pythonState);
    };
  });

  const [javascriptCodeRunning, setJavascriptCodeRunning] = useState<CodeRun | undefined>();
  useEffect(() => {
    const javascriptState = (_state: LanguageState, current?: CodeRun, awaitingExecution?: CodeRun[]) => {
      setJavascriptCodeRunning(current);
    };
    events.on('javascriptState', javascriptState);
    return () => {
      events.off('javascriptState', javascriptState);
    };
  });

  const [connectionCodeRunning, setConnectionCodeRunning] = useState<CodeRun | undefined>();
  useEffect(() => {
    const connectionState = (_state: LanguageState, current?: CodeRun, awaitingExecution?: CodeRun[]) => {
      setConnectionCodeRunning(current);
    };
    events.on('connectionState', connectionState);
    return () => {
      events.off('connectionState', connectionState);
    };
  });

  const [running, setRunning] = useState(0);
  useEffect(() => {
    setRunning((pythonCodeRunning ? 1 : 0) + (javascriptCodeRunning ? 1 : 0) + (connectionCodeRunning ? 1 : 0));
  }, [pythonCodeRunning, javascriptCodeRunning, connectionCodeRunning]);

  return (
    <DropdownMenu>
      <SidebarTooltip label="Kernel">
        <DropdownMenuTrigger asChild>
          <SidebarToggle>
            {triggerIcon}
            {transactionsInfo.length > 0 && (
              <div
                className={cn(
                  'pointer-events-none absolute flex h-4 w-4 items-center justify-center rounded-full bg-warning text-[10px] text-background',
                  running ? 'right-0 top-0 h-4 w-4' : 'right-1 top-1 h-2 w-2'
                )}
              >
                {running || ''}
              </div>
            )}
          </SidebarToggle>
        </DropdownMenuTrigger>
      </SidebarTooltip>
      <DropdownMenuContent
        side="right"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          focusGrid();
        }}
      >
        <DropdownMenuLabel>
          Status: {pythonCodeRunning || javascriptCodeRunning || connectionCodeRunning ? 'running' : 'idle'}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>
          {pythonState.pythonState === 'loading' ? 'Python loading...' : 'All code languages are ready'}
        </DropdownMenuLabel>
        {pythonCodeRunning && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Python {pythonState.version}</DropdownMenuLabel>
          </>
        )}
        {pythonCodeRunning && (
          <DropdownMenuItem onClick={pythonWebWorker.cancelExecution}>
            <Tooltip>
              <TooltipContent>Stop running cell</TooltipContent>
              <TooltipTrigger>
                <div className="ml-5 text-sm">
                  <StopIcon style={{ color: colors.darkGray }} />
                  Cell {xyToA1(pythonCodeRunning.sheetPos.x, pythonCodeRunning.sheetPos.y)}
                  {pythonCodeRunning.sheetPos.sheetId !== sheets.current
                    ? `, "${sheets.getById(pythonCodeRunning.sheetPos.sheetId)?.name || ''}"`
                    : ''}
                  {' is running...'}
                </div>
              </TooltipTrigger>
            </Tooltip>
          </DropdownMenuItem>
        )}
        {javascriptCodeRunning && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Javascript</DropdownMenuLabel>
          </>
        )}
        {javascriptCodeRunning && (
          <DropdownMenuItem onClick={javascriptWebWorker.cancelExecution}>
            <Tooltip>
              <TooltipContent>Stop running cell</TooltipContent>
              <TooltipTrigger>
                <div className="ml-5 text-sm">
                  <StopIcon style={{ color: colors.darkGray }} />
                  Cell {xyToA1(javascriptCodeRunning.sheetPos.x, javascriptCodeRunning.sheetPos.y)}
                  {javascriptCodeRunning.sheetPos.sheetId !== sheets.current
                    ? `, "${sheets.getById(javascriptCodeRunning.sheetPos.sheetId)?.name || ''}"`
                    : ''}
                  {' is running...'}
                </div>
              </TooltipTrigger>
            </Tooltip>
          </DropdownMenuItem>
        )}
        {connectionCodeRunning && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Connection</DropdownMenuLabel>
          </>
        )}
        {connectionCodeRunning && (
          <DropdownMenuItem onClick={() => quadraticCore.sendCancelExecution({ Connection: {} as any })}>
            <Tooltip>
              <TooltipContent>Stop running cell</TooltipContent>
              <TooltipTrigger>
                <div className="ml-5 text-sm">
                  <StopIcon style={{ color: colors.darkGray }} />
                  Cell {xyToA1(connectionCodeRunning.sheetPos.x, connectionCodeRunning.sheetPos.y)}
                  {connectionCodeRunning.sheetPos.sheetId !== sheets.current
                    ? `, "${sheets.getById(connectionCodeRunning.sheetPos.sheetId)?.name || ''}"`
                    : ''}
                  {' is running...'}
                </div>
              </TooltipTrigger>
            </Tooltip>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={disableRunCodeCell}
          onClick={() =>
            quadraticCore.rerunCodeCells(
              sheets.current,
              sheets.sheet.cursor.position.x,
              sheets.sheet.cursor.position.y,
              sheets.getCursorPosition()
            )
          }
        >
          Run current code cell
          <DropdownMenuShortcut className="pl-4">
            {KeyboardSymbols.Command + KeyboardSymbols.Enter}
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => quadraticCore.rerunCodeCells(sheets.current, undefined, undefined, sheets.getCursorPosition())}
        >
          Run all code cells in sheet
          <DropdownMenuShortcut className="pl-4">
            {KeyboardSymbols.Shift + KeyboardSymbols.Command + KeyboardSymbols.Enter}
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => quadraticCore.rerunCodeCells(undefined, undefined, undefined, sheets.getCursorPosition())}
        >
          Run all code cells in file
          <DropdownMenuShortcut className="pl-4">
            {KeyboardSymbols.Shift + KeyboardSymbols.Command + KeyboardSymbols.Alt + KeyboardSymbols.Enter}
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
