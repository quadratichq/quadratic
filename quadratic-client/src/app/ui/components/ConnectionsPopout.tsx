import { aiAnalystAtom } from '@/app/atoms/aiAnalystAtom';
import { editorInteractionStateShowConnectionsMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { focusGrid } from '@/app/helpers/focusGrid';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { SidebarToggle, SidebarTooltip } from '@/app/ui/QuadraticSidebar';
import { SettingsIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { useRecoilState, useSetRecoilState } from 'recoil';

// Update the KernelMenu component to accept a custom trigger
export const ConnectionsPopout = ({ triggerIcon }: { triggerIcon: React.ReactNode }) => {
  const { connections } = useConnectionsFetcher();
  const setShowConnectionsMenu = useSetRecoilState(editorInteractionStateShowConnectionsMenuAtom);
  // const setShowAIAnalyst = useSetRecoilState(showAIAnalystAtom);
  const [aiAnalyst, setAIAnalyst] = useRecoilState(aiAnalystAtom);

  return (
    <DropdownMenu>
      <SidebarTooltip label="Connections">
        <DropdownMenuTrigger asChild>
          <SidebarToggle pressed={aiAnalyst.contextConnectionUuid !== undefined}>{triggerIcon}</SidebarToggle>
        </DropdownMenuTrigger>
      </SidebarTooltip>
      <DropdownMenuContent
        side="right"
        align="start"
        alignOffset={-16}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          focusGrid();
        }}
      >
        {connections.map((connection) => (
          <DropdownMenuItem
            key={connection.uuid}
            onClick={() => {
              // TODO: what to do if already open?
              // setShowAIAnalyst(true);
              setAIAnalyst((prev) => ({
                ...prev,
                contextConnectionUuid: connection.uuid,
                // initialContext: { connection: { type: connection.type, id: connection.uuid, name: connection.name } },
              }));
            }}
          >
            <LanguageIcon language={connection.type} className="mr-3" />
            {connection.name}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => setShowConnectionsMenu(true)} className="text-muted-foreground">
          <SettingsIcon className="mr-3" />
          Manage connections...
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
