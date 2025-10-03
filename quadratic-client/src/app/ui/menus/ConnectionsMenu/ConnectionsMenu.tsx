import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { Connections } from '@/shared/components/connections/Connections';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';

export function ConnectionsMenu() {
  const {
    team: { uuid: teamUuid, sshPublicKey },
  } = useFileRouteLoaderData();
  const { connections, staticIps, isLoading } = useConnectionsFetcher();

  return (
    <div className="absolute bottom-0 left-12 right-0 top-0 z-[10000] bg-background">
      <Connections
        connections={connections}
        connectionsAreLoading={isLoading}
        teamUuid={teamUuid}
        sshPublicKey={sshPublicKey}
        staticIps={staticIps}
      />
    </div>
  );
}
