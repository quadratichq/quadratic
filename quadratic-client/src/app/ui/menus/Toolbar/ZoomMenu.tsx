import { Action } from '@/app/actions/actions';
import type { ActionArgs } from '@/app/actions/actionsSpec';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { events } from '@/app/events/events';
import { focusGrid } from '@/app/helpers/focusGrid';
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
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useCallback, useEffect, useState } from 'react';

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
        <DropdownMenuItemFromAction
          mixpanelEvent="[ZoomDropdown].zoomIn"
          action={Action.ZoomIn}
          actionArgs={undefined}
        />
        <DropdownMenuItemFromAction
          mixpanelEvent="[ZoomDropdown].zoomOut"
          action={Action.ZoomOut}
          actionArgs={undefined}
        />
        <DropdownMenuSeparator />
        <DropdownMenuItemFromAction
          mixpanelEvent="[ZoomDropdown].zoomToSelection"
          action={Action.ZoomToSelection}
          actionArgs={undefined}
        />
        <DropdownMenuItemFromAction
          mixpanelEvent="[ZoomDropdown].zoomToFit"
          action={Action.ZoomToFit}
          actionArgs={undefined}
        />
        <DropdownMenuSeparator />
        <DropdownMenuItemFromAction
          mixpanelEvent="[ZoomDropdown].zoomTo50%"
          action={Action.ZoomTo50}
          actionArgs={undefined}
        />
        <DropdownMenuItemFromAction
          mixpanelEvent="[ZoomDropdown].zoomTo100%"
          action={Action.ZoomTo100}
          actionArgs={undefined}
        />
        <DropdownMenuItemFromAction
          mixpanelEvent="[ZoomDropdown].zoomTo200%"
          action={Action.ZoomTo200}
          actionArgs={undefined}
        />
        <DropdownMenuSeparator />
        <DropdownMenuItemFromAction
          mixpanelEvent="[ZoomDropdown].zoomReset"
          action={Action.ZoomReset}
          actionArgs={undefined}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

function DropdownMenuItemFromAction<T extends Action>({
  action,
  actionArgs,
  mixpanelEvent,
}: {
  action: T;
  actionArgs: T extends keyof ActionArgs ? ActionArgs[T] : void;
  mixpanelEvent: string;
}) {
  const actionSpec = defaultActionSpec[action];
  const shortcutDisplay = keyboardShortcutEnumToDisplay(action);
  const label = actionSpec.label();
  return (
    <DropdownMenuItem
      onClick={() => {
        trackEvent(mixpanelEvent);
        actionSpec.run(actionArgs);
      }}
    >
      {label} {shortcutDisplay && <DropdownMenuShortcut>{shortcutDisplay}</DropdownMenuShortcut>}
    </DropdownMenuItem>
  );
}
