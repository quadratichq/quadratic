import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { events } from '@/app/events/events';
import { keyboardShortcutEnumToDisplay } from '@/app/helpers/keyboardShortcutsDisplay';
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
      <DropdownMenuTrigger className="flex w-24 items-center justify-between px-2 text-sm">
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
        <DropdownMenuItemFromAction mixpanelEvent="[ZoomDropdown].zoomIn" action={Action.ZoomIn} />
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

function DropdownMenuItemFromAction({ action, mixpanelEvent }: { action: Action; mixpanelEvent: string }) {
  const actionSpec = defaultActionSpec[action];
  if (actionSpec === undefined) {
    throw new Error(`No action spec found for action: ${action}`);
  }

  const shortcutDisplay = keyboardShortcutEnumToDisplay(action);
  return (
    <DropdownMenuItem
      onClick={() => {
        mixpanel.track(mixpanelEvent);
        actionSpec.run();
      }}
    >
      {actionSpec.label} {shortcutDisplay && <DropdownMenuShortcut>{shortcutDisplay}</DropdownMenuShortcut>}
    </DropdownMenuItem>
  );
}
