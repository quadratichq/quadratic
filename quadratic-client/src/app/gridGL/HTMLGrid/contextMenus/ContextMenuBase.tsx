/* eslint-disable @typescript-eslint/no-unused-vars */
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

  const left = contextMenu.world?.x ?? 0;
  const [top, setTop] = useState(contextMenu.world?.y ?? 0);
  // useEffect(() => {
  //   const updateAfterRender = () => {
  //     const content = refContent.current;
  //     if (open && content) {
  //       let newTop = contextMenu.world?.y ?? 0;
  //       if (open && content) {
  //         // we use the screen bounds in world coordinates to determine if the
  //         // menu is going to be cut off
  //         const viewportTop = pixiApp.viewport.toWorld(0, 0).y;
  //         const viewportBottom = pixiApp.viewport.toWorld(0, window.innerHeight).y;

  //         // we use the viewport bounds to determine the direction the menu is
  //         // opening
  //         const bounds = pixiApp.viewport.getVisibleBounds();

  //         // menu is opening downwards
  //         if (newTop < bounds.y + bounds.height / 2) {
  //           if (newTop + content.offsetHeight > viewportBottom) {
  //             newTop = viewportBottom - content.offsetHeight;
  //           }
  //         }

  //         // menu is opening upwards
  //         else {
  //           if (newTop - content.offsetHeight < viewportTop) {
  //             newTop = viewportTop + content.offsetHeight;
  //           }
  //         }
  //       }
  //       setTop(newTop);
  //     }
  //   };

  //   // need to wait for the next render to update the position
  //   setTimeout(updateAfterRender);
  // }, [contextMenu.world, open]);

  return (
    // <div
    //   className="absolute"
    //   ref={ref}
    //   style={{
    //     left,
    //     top,
    //     transform: `scale(${1 / pixiApp.viewport.scale.x})`,
    //     pointerEvents: 'auto',
    //     display: open ? 'block' : 'none',
    //   }}
    // >
    <DropdownMenu
      modal={false}
      open={isOpen}
      onOpenChange={(dropdownOpen) => {
        setIsOpen(dropdownOpen);
        if (!dropdownOpen) onClose();
      }}
    >
      {/* Radix wants the trigger for positioning the content, so we hide it visibly */}
      <DropdownMenuTrigger
        ref={ref}
        style={{ left, top, transform: `scale(${1 / pixiApp.viewport.scale.x})`, display: open ? 'block' : 'none' }}
        className="pointer-events-auto absolute h-0 w-0 opacity-0"
      ></DropdownMenuTrigger>
      <DropdownMenuContent
        ref={refContent}
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
    // </div>
  );
};
