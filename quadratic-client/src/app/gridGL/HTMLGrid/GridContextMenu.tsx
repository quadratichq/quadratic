//! This shows the grid heading context menu.

import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { contextMenuAtom, ContextMenuType } from '@/app/atoms/contextMenuAtoms';
import { sheets } from '@/app/grid/controller/Sheets';
import { focusGrid } from '@/app/helpers/focusGrid';
import { keyboardShortcutEnumToDisplay } from '@/app/helpers/keyboardShortcutsDisplay';
import { useIsAvailableArgs } from '@/app/ui/hooks/useIsAvailableArgs';
import { IconComponent } from '@/shared/components/Icons';
import { ControlledMenu, MenuDivider, MenuItem } from '@szhsin/react-menu';
import { useCallback, useEffect, useRef } from 'react';
import { useRecoilState } from 'recoil';
import { pixiApp } from '../pixiApp/PixiApp';

export const GridContextMenu = () => {
  const [contextMenu, setContextMenu] = useRecoilState(contextMenuAtom);

  const onClose = useCallback(() => {
    setContextMenu({ type: undefined, world: undefined, column: null, row: null });
    focusGrid();
  }, [setContextMenu]);

  useEffect(() => {
    pixiApp.viewport.on('moved', onClose);
    pixiApp.viewport.on('zoomed', onClose);

    return () => {
      pixiApp.viewport.off('moved', onClose);
      pixiApp.viewport.off('zoomed', onClose);
    };
  }, [onClose]);

  const ref = useRef<HTMLDivElement>(null);

  const isColumnRowAvailable = sheets.sheet.cursor.hasOneColumnRowSelection(true);

  return (
    <div
      className="absolute"
      ref={ref}
      style={{
        left: contextMenu.world?.x ?? 0,
        top: contextMenu.world?.y ?? 0,
        transform: `scale(${1 / pixiApp.viewport.scale.x})`,
        pointerEvents: 'auto',
        display: contextMenu.type === ContextMenuType.Grid ? 'block' : 'none',
      }}
    >
      <ControlledMenu
        state={contextMenu?.world ? 'open' : 'closed'}
        onClose={onClose}
        anchorRef={ref}
        menuStyle={{ padding: '0', color: 'inherit' }}
        menuClassName="bg-background"
      >
        <MenuItemAction action={Action.Cut} />
        <MenuItemAction action={Action.Copy} />
        <MenuItemAction action={Action.Paste} />
        <MenuItemAction action={Action.PasteValuesOnly} />
        <MenuItemAction action={Action.PasteFormattingOnly} />
        <MenuItemAction action={Action.CopyAsPng} />
        <MenuItemAction action={Action.DownloadAsCsv} />

        {contextMenu.column === null ? null : (
          <>
            <MenuDivider />
            {isColumnRowAvailable && <MenuItemAction action={Action.InsertColumnLeft} />}
            {isColumnRowAvailable && <MenuItemAction action={Action.InsertColumnRight} />}
            <MenuItemAction action={Action.DeleteColumn} />
          </>
        )}

        {contextMenu.row === null ? null : (
          <>
            {isColumnRowAvailable && <MenuDivider />}
            {isColumnRowAvailable && <MenuItemAction action={Action.InsertRowAbove} />}
            {isColumnRowAvailable && <MenuItemAction action={Action.InsertRowBelow} />}
            <MenuItemAction action={Action.DeleteRow} />
          </>
        )}

        <MenuDivider />
        <MenuItemAction action={Action.FlattenDataTable} />
        <MenuItemAction action={Action.GridToDataTable} />
        <MenuItemAction action={Action.SortDataTableFirstColAsc} />
        <MenuItemAction action={Action.SortDataTableFirstColDesc} />
        <MenuItemAction action={Action.AddFirstRowAsHeaderDataTable} />
        <MenuItemAction action={Action.RemoveFirstRowAsHeaderDataTable} />
      </ControlledMenu>
    </div>
  );
};

function MenuItemAction({ action }: { action: Action }) {
  const { label, Icon, run, isAvailable } = defaultActionSpec[action];
  const isAvailableArgs = useIsAvailableArgs();
  const keyboardShortcut = keyboardShortcutEnumToDisplay(action);

  if (isAvailable && !isAvailable(isAvailableArgs)) {
    return null;
  }

  return (
    <MenuItemShadStyle Icon={Icon} onClick={run} keyboardShortcut={keyboardShortcut}>
      {label}
    </MenuItemShadStyle>
  );
}

function MenuItemShadStyle({
  children,
  Icon,
  onClick,
  keyboardShortcut,
}: {
  children: string;
  Icon?: IconComponent;
  onClick: any;
  keyboardShortcut?: string;
}) {
  const menuItemClassName =
    'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50';
  return (
    <MenuItem className={menuItemClassName} onClick={onClick}>
      <span className="mr-4 flex items-center">
        {Icon && <Icon className="-ml-3 mr-4" />} {children}
      </span>
      {keyboardShortcut && (
        <span className="ml-auto text-xs tracking-widest text-muted-foreground">{keyboardShortcut}</span>
      )}
    </MenuItem>
  );
}
