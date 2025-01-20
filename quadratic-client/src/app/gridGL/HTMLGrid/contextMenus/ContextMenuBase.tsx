import type { ContextMenuState, ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { contextMenuAtom } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { focusGrid } from '@/app/helpers/focusGrid';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/shared/shadcn/ui/dropdown-menu';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  const ref = useRef<HTMLButtonElement>(null);
  const refContent = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useRecoilState(contextMenuAtom);
  const open = contextMenu.type === contextMenuType && !contextMenu.rename;

  // Local state for the dropdown menu
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    setIsOpen(open);
  }, [open]);

  const onClose = useCallback(() => {
    // we don't want to stop renaming when moving the viewport
    if (contextMenu.rename) return;

    setContextMenu({});
    events.emit('contextMenuClose');
    focusGrid();
  }, [contextMenu.rename, setContextMenu]);

  useEffect(() => {
    pixiApp.viewport.on('moved', onClose);
    pixiApp.viewport.on('zoomed', onClose);

    return () => {
      pixiApp.viewport.off('moved', onClose);
      pixiApp.viewport.off('zoomed', onClose);
    };
  }, [onClose]);

  const bounds = pixiApp.viewport.getVisibleBounds();
  const left = contextMenu.world?.x ?? 0;
  const top = contextMenu.world?.y ?? 0;

  return (
    <DropdownMenu
      modal={false}
      open={isOpen}
      onOpenChange={(dropdownOpen) => {
        setIsOpen(dropdownOpen);
        if (!dropdownOpen) onClose();
      }}
    >
      <DropdownMenuTrigger
        ref={ref}
        style={{ left, top, transform: `scale(${1 / pixiApp.viewport.scale.x})`, display: open ? 'block' : 'none' }}
        className="pointer-events-auto absolute h-0 w-0 opacity-0"
      ></DropdownMenuTrigger>
      <DropdownMenuContent
        ref={refContent}
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
      >
        {children({ contextMenu })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
