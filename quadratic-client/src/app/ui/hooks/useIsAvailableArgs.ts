import { useRootRouteLoaderData } from '@/routes/_root';
import { useFileRouteLoaderDataRequired } from '@/shared/hooks/useFileRouteLoaderData';

export const useIsAvailableArgs = () => {
  const { isAuthenticated } = useRootRouteLoaderData();
  const {
    userMakingRequest: { fileTeamPrivacy, teamPermissions, filePermissions },
  } = useFileRouteLoaderDataRequired();

  const isAvailableArgs = {
    isAuthenticated,
    filePermissions,
    fileTeamPrivacy,
    teamPermissions,
  };

  return isAvailableArgs;
};
