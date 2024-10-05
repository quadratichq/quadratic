import { usePythonState } from '@/app/atoms/usePythonState';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { focusGrid } from '@/app/helpers/focusGrid';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { colors } from '@/app/theme/colors';
import { SidebarToggle, SidebarTooltip } from '@/app/ui/QuadraticSidebar';
import type { CodeRun } from '@/app/web-workers/CodeRun';
import { javascriptWebWorker } from '@/app/web-workers/javascriptWebWorker/javascriptWebWorker';
import { LanguageState } from '@/app/web-workers/languageTypes';
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
import StopIcon from '@mui/icons-material/Stop';
import { TooltipTrigger } from '@radix-ui/react-tooltip';
import { useEffect, useState } from 'react';

// Update the KernelMenu component to accept a custom trigger
export const KernelMenu = ({ triggerIcon }: { triggerIcon: React.ReactNode }) => {
  const [disableRunCodeCell, setDisableRunCodeCell] = useState(true);
  useEffect(() => {
    const checkRunCodeCell = () => setDisableRunCodeCell(!pixiApp.isCursorOnCodeCell());
    events.on('cursorPosition', checkRunCodeCell);
    checkRunCodeCell();
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
            {running > 0 && (
              <div className="pointer-events-none absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-warning text-[10px] text-background">
                {running}
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
                  cell({pythonCodeRunning.sheetPos.x}, {pythonCodeRunning.sheetPos.y}
                  {pythonCodeRunning.sheetPos.sheetId !== sheets.sheet.id
                    ? `, "${sheets.getById(pythonCodeRunning.sheetPos.sheetId)?.name || ''}"`
                    : ''}
                  ) is running...
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
                  cell({javascriptCodeRunning.sheetPos.x}, {javascriptCodeRunning.sheetPos.y}
                  {javascriptCodeRunning.sheetPos.sheetId !== sheets.sheet.id
                    ? `, "${sheets.getById(javascriptCodeRunning.sheetPos.sheetId)?.name || ''}"`
                    : ''}
                  ) is running...
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
                  cell({connectionCodeRunning.sheetPos.x}, {connectionCodeRunning.sheetPos.y}
                  {connectionCodeRunning.sheetPos.sheetId !== sheets.sheet.id
                    ? `, "${sheets.getById(connectionCodeRunning.sheetPos.sheetId)?.name || ''}"`
                    : ''}
                  ) is running...
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
              sheets.sheet.id,
              sheets.sheet.cursor.cursorPosition.x,
              sheets.sheet.cursor.cursorPosition.y,
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
          onClick={() =>
            quadraticCore.rerunCodeCells(sheets.sheet.id, undefined, undefined, sheets.getCursorPosition())
          }
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
