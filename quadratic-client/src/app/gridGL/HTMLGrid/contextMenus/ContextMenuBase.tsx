import { contextMenuAtom, ContextMenuState, ContextMenuType } from '@/app/atoms/contextMenuAtom';
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
  const ref = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useRecoilState(contextMenuAtom);
  const open = contextMenu.type === contextMenuType && !contextMenu.rename;

  // Local state for the dropdown menu
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    setIsOpen(open);
  }, [open]);

  const onClose = useCallback(() => {
    setContextMenu({});
    events.emit('contextMenuClose');
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

  return (
    <div
      className="absolute"
      ref={ref}
      style={{
        left: contextMenu.world?.x ?? 0,
        top: contextMenu.world?.y ?? 0,
        transform: `scale(${1 / pixiApp.viewport.scale.x})`,
        pointerEvents: 'auto',
        display: open ? 'block' : 'none',
      }}
    >
      <DropdownMenu
        modal={false}
        open={isOpen}
        onOpenChange={(dropdownOpen) => {
          setIsOpen(dropdownOpen);
          if (!dropdownOpen) onClose();
        }}
      >
        {/* Radix wants the trigger for positioning the content, so we hide it visibly */}
        <DropdownMenuTrigger className="h-0 w-0 opacity-0">Menu</DropdownMenuTrigger>
        <DropdownMenuContent
          animate={false}
          side="bottom"
          sideOffset={0}
          align="start"
          alignOffset={0}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {children({ contextMenu })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
