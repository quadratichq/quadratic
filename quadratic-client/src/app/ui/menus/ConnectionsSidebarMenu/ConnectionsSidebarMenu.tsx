import { focusGrid } from '@/app/helpers/focusGrid';
import { useConnectionsDropdownHandlers } from '@/app/ui/hooks/useConnectionsDropdownHandlers';
import { SidebarToggle, SidebarTooltip } from '@/app/ui/QuadraticSidebar';
import { ConnectionsMenuContent } from '@/shared/components/connections/ConnectionsMenuContent';
import { DatabaseIcon } from '@/shared/components/Icons';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/shared/shadcn/ui/dropdown-menu';
import { memo } from 'react';

interface ConnectionsSidebarMenuProps {
  'data-walkthrough'?: string;
}

export const ConnectionsSidebarMenu = memo(({ 'data-walkthrough': dataWalkthrough }: ConnectionsSidebarMenuProps) => {
  const { connections, activeConnectionId, didSelectConnection, handleSelectConnection, handleAddConnection } =
    useConnectionsDropdownHandlers('ConnectionsSidebarMenu');

  return (
    <DropdownMenu>
      <SidebarTooltip label="Connections">
        <DropdownMenuTrigger asChild>
          <SidebarToggle pressed={false} data-walkthrough={dataWalkthrough}>
            <DatabaseIcon />
          </SidebarToggle>
        </DropdownMenuTrigger>
      </SidebarTooltip>

      <DropdownMenuContent
        side="right"
        align="start"
        className="max-w-72"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (!didSelectConnection()) {
            focusGrid();
          }
        }}
      >
        <ConnectionsMenuContent
          connections={connections}
          activeConnectionId={activeConnectionId}
          onSelectConnection={handleSelectConnection}
          onAddConnection={handleAddConnection}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

ConnectionsSidebarMenu.displayName = 'ConnectionsSidebarMenu';
