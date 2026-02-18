import type { Action } from '@/app/actions/actions';
import type { ActionArgs } from '@/app/actions/actionsSpec';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { contextMenuAtom } from '@/app/atoms/contextMenuAtom';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { focusGrid } from '@/app/helpers/focusGrid';
import { keyboardShortcutEnumToDisplay } from '@/app/helpers/keyboardShortcutsDisplay';
import { useIsAvailableArgs } from '@/app/ui/hooks/useIsAvailableArgs';
import { CheckIcon } from '@/shared/components/Icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { cn } from '@/shared/shadcn/utils';
import type { JSX } from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { useRecoilState } from 'recoil';

/**
 * Wrapper component for any context menu on the grid.
 */
export const ContextMenuBase = ({ children }: { children: React.ReactNode }) => {
  const [contextMenu, setContextMenu] = useRecoilState(contextMenuAtom);

  const onClose = useCallback(() => {
    // we don't want to stop renaming when moving the viewport
    if (contextMenu.rename) return;

    setContextMenu({});
    focusGrid();
  }, [contextMenu.rename, setContextMenu]);

  useEffect(() => {
    const handleMoved = ({ type }: { type: string }) => {
      // right click can trigger move (decelerate) event and close the context menu
      // ignore move (decelerate) event
      if (type !== 'decelerate') {
        onClose();
      }
    };

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.target instanceof HTMLElement && !event.target.closest('.context-menu-base, .pixi_canvas')) {
        setContextMenu({});
      }
    };

    pixiApp.viewport.on('moved', handleMoved);
    pixiApp.viewport.on('zoomed', onClose);
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      pixiApp.viewport.off('moved', handleMoved);
      pixiApp.viewport.off('zoomed', onClose);
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [onClose, setContextMenu]);

  const open = useMemo(() => !contextMenu.rename && Boolean(children), [contextMenu.rename, children]);
  if (!open) {
    return null;
  }

  const left = contextMenu.world?.x ?? 0;
  const top = contextMenu.world?.y ?? 0;
  const bounds = pixiApp.viewport.getVisibleBounds();

  return (
    <DropdownMenu modal={false} open={open}>
      <DropdownMenuTrigger
        style={{ left, top, transform: `scale(${1 / pixiApp.viewport.scale.x})` }}
        className="pointer-events-auto absolute h-0 w-0 opacity-0"
      ></DropdownMenuTrigger>
      <DropdownMenuContent
        className="context-menu-base"
        animate={false}
        side={left < bounds.x + bounds.width / 2 ? 'right' : 'left'}
        sideOffset={4}
        align={top < bounds.y + bounds.height / 2 ? 'start' : 'end'}
        alignOffset={0}
        onCloseAutoFocus={(e) => e.preventDefault()}
        collisionBoundary={document.querySelector('.grid-container')}
        collisionPadding={8}
        hideWhenDetached={false}
        avoidCollisions={true}
        updatePositionStrategy="always"
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/**
 * Component for rendering an Action in a context menu
 */
export const ContextMenuItemAction = <T extends Action>(props: {
  action: T;
  actionArgs: T extends keyof ActionArgs ? ActionArgs[T] : void;
  // allows overriding of the default option (which sets the menu item to bold)
  overrideDefaultOption?: boolean;
  labelOverride?: string;
}): JSX.Element | null => {
  const { overrideDefaultOption, labelOverride } = props;
  const { label, Icon, run, isAvailable, checkbox, defaultOption } = defaultActionSpec[props.action];
  const isAvailableArgs = useIsAvailableArgs();
  const keyboardShortcut = keyboardShortcutEnumToDisplay(props.action);

  if (isAvailable && !isAvailable(isAvailableArgs)) {
    return null;
  }

  let icon = Icon ? <Icon /> : null;

  if (!Icon && checkbox !== undefined) {
    const checked = typeof checkbox === 'function' ? checkbox() : checkbox === true;
    if (checked) {
      icon = <CheckIcon />;
    }
  }

  return (
    <DropdownMenuItem onClick={() => run(props.actionArgs)} className="py-1">
      <ContextMenuItem
        icon={
          <>
            {icon}
            {checkbox === true && <CheckIcon />}
          </>
        }
        text={labelOverride ?? label()}
        textBold={overrideDefaultOption ?? defaultOption}
        shortcut={keyboardShortcut}
      />
    </DropdownMenuItem>
  );
};

function ContextMenuItem({
  icon,
  text,
  textBold,
  shortcut,
}: {
  icon: React.ReactNode;
  text: React.ReactNode;
  textBold?: boolean;
  shortcut?: React.ReactNode;
}) {
  return (
    <>
      <span className="mr-1 flex h-6 w-6 items-center justify-center">{icon}</span>
      <span className={cn(textBold ? 'font-bold' : '')}>{text}</span>
      {shortcut && (
        <span className="ml-auto">
          <DropdownMenuShortcut className="ml-6">{shortcut}</DropdownMenuShortcut>
        </span>
      )}
    </>
  );
}
