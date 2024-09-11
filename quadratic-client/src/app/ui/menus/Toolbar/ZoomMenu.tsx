import { Action } from '@/app/actions/actions';
import { ActionArgs } from '@/app/actions/actionsSpec';
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
        <DropdownMenuItemFromAction
          mixpanelEvent="[ZoomDropdown].zoomIn"
          action={Action.FormatTextColor}
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
  if (actionSpec === undefined) {
    throw new Error(`No action spec found for action: ${action}`);
  }

  const shortcutDisplay = keyboardShortcutEnumToDisplay(action);
  return (
    <DropdownMenuItem
      onClick={() => {
        mixpanel.track(mixpanelEvent);
        actionSpec.run(actionArgs);
      }}
    >
      {actionSpec.label} {shortcutDisplay && <DropdownMenuShortcut>{shortcutDisplay}</DropdownMenuShortcut>}
    </DropdownMenuItem>
  );
}
