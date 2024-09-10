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
import { focusGrid } from '../../../helpers/focusGrid';

export const ZoomMenu = () => {
  const [zoom, setZoom] = useState(1);
  const handleZoom = useCallback((scale: number) => setZoom(scale), [setZoom]);

  useEffect(() => {
    events.on('zoom', handleZoom);
    return () => {
      events.off('zoom', handleZoom);
    };
  }, [handleZoom]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group flex h-full w-24 items-center justify-between border-l border-border px-2 text-sm hover:bg-accent focus:bg-accent focus:outline-none data-[state=open]:bg-accent">
        {zoom === Infinity ? 100 : Math.round(zoom * 100)}%
        <ArrowDropDownIcon className="text-muted-foreground group-hover:text-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-48"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          focusGrid();
        }}
      >
        <DropdownMenuItemFromAction mixpanelEvent="[ZoomDropdown].zoomIn" action={Action.ZoomIn} />
        <DropdownMenuItemFromAction mixpanelEvent="[ZoomDropdown].zoomOut" action={Action.ZoomOut} />
        <DropdownMenuSeparator />
        <DropdownMenuItemFromAction mixpanelEvent="[ZoomDropdown].zoomToSelection" action={Action.ZoomToSelection} />
        <DropdownMenuItemFromAction mixpanelEvent="[ZoomDropdown].zoomToFit" action={Action.ZoomToFit} />
        <DropdownMenuSeparator />
        <DropdownMenuItemFromAction mixpanelEvent="[ZoomDropdown].zoomTo50%" action={Action.ZoomTo50} />
        <DropdownMenuItemFromAction mixpanelEvent="[ZoomDropdown].zoomTo100%" action={Action.ZoomTo100} />
        <DropdownMenuItemFromAction mixpanelEvent="[ZoomDropdown].zoomTo200%" action={Action.ZoomTo200} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

function DropdownMenuItemFromAction({
  action,
  mixpanelEvent,
}: {
  action: keyof typeof defaultActionSpec;
  mixpanelEvent: string;
}) {
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
