import type { ContextMenuState, ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { contextMenuAtom } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { focusGrid } from '@/app/helpers/focusGrid';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/shared/shadcn/ui/dropdown-menu';
import { useCallback, useEffect } from 'react';
import { useRecoilState } from 'recoil';

/**
 * Wrapper component for any context menu on the grid.
 */
export const ContextMenuBase = ({
  children,
  contextMenuType,
}: {
  children: ({ contextMenu }: { contextMenu: ContextMenuState }) => React.ReactNode;
  contextMenuType: ContextMenuType;
}) => {
  const [contextMenu, setContextMenu] = useRecoilState(contextMenuAtom);

  const onClose = useCallback(() => {
    // we don't want to stop renaming when moving the viewport
    if (contextMenu.rename) return;

    setContextMenu({});
    events.emit('contextMenuClose');
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

    pixiApp.viewport.on('moved', handleMoved);
    pixiApp.viewport.on('zoomed', onClose);

    return () => {
      pixiApp.viewport.off('moved', handleMoved);
      pixiApp.viewport.off('zoomed', onClose);
    };
  }, [onClose]);

  const open = contextMenu.type === contextMenuType && !contextMenu.rename;
  if (!open) {
    return null;
  }

  const left = contextMenu.world?.x ?? 0;
  const top = contextMenu.world?.y ?? 0;
  const bounds = pixiApp.viewport.getVisibleBounds();

  return (
    <DropdownMenu
      modal={false}
      open={open}
      onOpenChange={(dropdownOpen) => {
        // if (!dropdownOpen) onClose();
      }}
    >
      <DropdownMenuTrigger
        style={{ left, top, transform: `scale(${1 / pixiApp.viewport.scale.x})` }}
        className="pointer-events-auto absolute h-0 w-0 opacity-0"
      ></DropdownMenuTrigger>
      <DropdownMenuContent
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
        {children({ contextMenu })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
