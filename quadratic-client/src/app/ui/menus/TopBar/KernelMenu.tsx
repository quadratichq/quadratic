import { usePythonState } from '@/app/atoms/usePythonState';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { colors } from '@/app/theme/colors';
import { MenuLineItem } from '@/app/ui/menus/TopBar/MenuLineItem';
import { TopBarMenuItem } from '@/app/ui/menus/TopBar/TopBarMenuItem';
import { javascriptWebWorker } from '@/app/web-workers/javascriptWebWorker/javascriptWebWorker';
import { CodeRun, LanguageState } from '@/app/web-workers/languageTypes';
import { pythonWebWorker } from '@/app/web-workers/pythonWebWorker/pythonWebWorker';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Tooltip, TooltipContent, TooltipProvider } from '@/shared/shadcn/ui/tooltip';
import DeveloperBoardIcon from '@mui/icons-material/DeveloperBoard';
import StopIcon from '@mui/icons-material/Stop';
import { TooltipTrigger } from '@radix-ui/react-tooltip';
import { Menu, MenuDivider, MenuHeader, MenuItem } from '@szhsin/react-menu';
import '@szhsin/react-menu/dist/index.css';
import { useEffect, useState } from 'react';

export const KernelMenu = () => {
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

  const [running, setRunning] = useState(0);
  useEffect(() => {
    setRunning((pythonCodeRunning ? 1 : 0) + (javascriptCodeRunning ? 1 : 0));
  }, [pythonCodeRunning, javascriptCodeRunning]);

  return (
    <Menu
      menuButton={({ open }) => (
        <TopBarMenuItem title="Kernel Menu" open={open}>
          <DeveloperBoardIcon />
          {running > 0 && (
            <div
              className="absolute top-1 rounded-full px-1 text-xs text-white"
              style={{ background: colors.darkGray }}
            >
              {running}
            </div>
          )}
        </TopBarMenuItem>
      )}
    >
      <MenuItem>
        <MenuLineItem primary={`Status: ${pythonCodeRunning || javascriptCodeRunning ? 'running' : 'idle'}`} />
      </MenuItem>
      <MenuDivider />
      <MenuItem disabled={true}>
        <MenuLineItem
          primary={pythonState.pythonState === 'loading' ? 'Python loading...' : 'all code languages are ready'}
        />
      </MenuItem>
      {pythonCodeRunning && (
        <>
          <MenuDivider />
          <MenuHeader>
            <MenuLineItem primary={`Python ${pythonState.version}`}></MenuLineItem>
          </MenuHeader>
        </>
      )}
      {pythonCodeRunning && (
        <MenuItem onClick={pythonWebWorker.cancelExecution}>
          <TooltipProvider>
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
          </TooltipProvider>
        </MenuItem>
      )}
      {javascriptCodeRunning && (
        <>
          <MenuDivider />
          <MenuHeader>
            <MenuLineItem primary="Javascript"></MenuLineItem>
          </MenuHeader>
        </>
      )}
      {javascriptCodeRunning && (
        <MenuItem onClick={javascriptWebWorker.cancelExecution}>
          <TooltipProvider>
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
          </TooltipProvider>
        </MenuItem>
      )}
      <MenuDivider />
      <MenuItem
        disabled={disableRunCodeCell}
        onClick={() =>
          quadraticCore.rerunCodeCells(
            sheets.sheet.id,
            sheets.sheet.cursor.originPosition.x,
            sheets.sheet.cursor.originPosition.y,
            sheets.getCursorPosition()
          )
        }
      >
        <MenuLineItem primary="Run current code cell" secondary={KeyboardSymbols.Command + KeyboardSymbols.Enter} />
      </MenuItem>
      <MenuItem
        onClick={() => quadraticCore.rerunCodeCells(sheets.sheet.id, undefined, undefined, sheets.getCursorPosition())}
      >
        <MenuLineItem
          primary="Run all code cells in sheet"
          secondary={KeyboardSymbols.Shift + KeyboardSymbols.Command + KeyboardSymbols.Enter}
        />
      </MenuItem>
      <MenuItem
        onClick={() => quadraticCore.rerunCodeCells(undefined, undefined, undefined, sheets.getCursorPosition())}
      >
        <MenuLineItem
          primary="Run all code cells in file"
          secondary={KeyboardSymbols.Shift + KeyboardSymbols.Command + KeyboardSymbols.Alt + KeyboardSymbols.Enter}
        />
      </MenuItem>
    </Menu>
  );
};
