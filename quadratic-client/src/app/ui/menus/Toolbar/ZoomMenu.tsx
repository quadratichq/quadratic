import { GenericAction } from '@/app/actions/actionTypes';
import { zoomIn } from '@/app/actions/view';
import { events } from '@/app/events/events';
import { ArrowDropDownIcon } from '@/shared/components/Icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import mixpanel from 'mixpanel-browser';
import { useCallback, useEffect, useState } from 'react';
import { zoomInOut, zoomToFit, zoomToSelection } from '../../../gridGL/helpers/zoom';
import { focusGrid } from '../../../helpers/focusGrid';
import { KeyboardSymbols } from '../../../helpers/keyboardSymbols';

export const ZoomMenu = () => {
  const [zoom, setZoom] = useState(1);
  const handleZoom = useCallback((scale: number) => setZoom(scale), [setZoom]);

  useEffect(() => {
    events.on('zoom', handleZoom);
    return () => {
      events.off('zoom', handleZoom);
    };
  }, [handleZoom]);

  const setZoomState = useCallback((value: number) => {
    zoomInOut(value);
    focusGrid();
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-24 items-center justify-between px-2 text-sm hover:bg-accent">
        {zoom === Infinity ? 100 : Math.round(zoom * 100)}%
        <ArrowDropDownIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-48"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          focusGrid();
        }}
      >
        {/* Prototype for the new approach to centralized actions */}
        <DropdownMenuItemFromAction mixpanelEvent="[ZoomDropdown].zoomIn" action={zoomIn} />
        <DropdownMenuItem
          onClick={() => {
            mixpanel.track('[ZoomDropdown].zoomOut');
            setZoomState(zoom * 0.5);
          }}
        >
          Zoom out <DropdownMenuShortcut>{KeyboardSymbols.Command + '−'}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            mixpanel.track('[ZoomDropdown].zoomToSelection');
            zoomToSelection();
          }}
        >
          Zoom to selection <DropdownMenuShortcut>{KeyboardSymbols.Command + '8'}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            mixpanel.track('[ZoomDropdown].zoomToFit');
            zoomToFit();
          }}
        >
          Zoom to fit <DropdownMenuShortcut>{KeyboardSymbols.Command + '9'}</DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => {
            mixpanel.track('[ZoomDropdown].zoom50%');
            setZoomState(0.5);
          }}
        >
          Zoom to 50%
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => {
            mixpanel.track('[ZoomDropdown].zoom100%');
            setZoomState(1);
          }}
        >
          Zoom to 100% <DropdownMenuShortcut>{KeyboardSymbols.Command + '0'}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            mixpanel.track('[ZoomDropdown].zoom200%');
            setZoomState(2);
          }}
        >
          Zoom to 200% <DropdownMenuShortcut></DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

function DropdownMenuItemFromAction({ action, mixpanelEvent }: { action: GenericAction; mixpanelEvent: string }) {
  const shortcutDisplay = keyboardShortcutEnumToDisplay(action.keyboardShortcut);
  return (
    <DropdownMenuItem
      onClick={() => {
        mixpanel.track(mixpanelEvent);
        action.run();
      }}
    >
      {action.label} {shortcutDisplay && <DropdownMenuShortcut>{KeyboardSymbols.Command + '+'}</DropdownMenuShortcut>}
    </DropdownMenuItem>
  );
}

// TODO: this would be moved somewhere that maps Ayush's keyboard shortcuts to a displayable version
function keyboardShortcutEnumToDisplay(shortcut?: string) {
  return 'TODO';
}
