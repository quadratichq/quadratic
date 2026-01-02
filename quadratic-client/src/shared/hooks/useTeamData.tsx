import type { GetTeamData } from '@/routes/api.teams.$teamUuid';
import { ROUTE_LOADER_IDS, ROUTES } from '@/shared/constants/routes';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { isJsonObject } from '@/shared/utils/isJsonObject';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { useEffect, useMemo, useRef } from 'react';
import { useFetcher, useFetchers, useRouteLoaderData } from 'react-router';

type TeamData = ApiTypes['/v0/teams/:uuid.GET.response'];

// Dashboard route loader data type
type DashboardLoaderData = {
  teams: ApiTypes['/v0/teams.GET.response']['teams'];
  userMakingRequest: ApiTypes['/v0/teams.GET.response']['userMakingRequest'] & {
    clientDataKv?: ApiTypes['/v0/user/client-data-kv.GET.response']['clientDataKv'];
  };
  eduStatus: ApiTypes['/v0/education.GET.response']['eduStatus'];
  activeTeam: TeamData;
};

export function useTeamData() {
  // Try to get team data from dashboard route loader
  let dashboardTeam: TeamData | null = null;
  try {
    const dashboardData = useRouteLoaderData(ROUTE_LOADER_IDS.DASHBOARD) as DashboardLoaderData | null | undefined;
    dashboardTeam = dashboardData?.activeTeam ?? null;
  } catch {
    dashboardTeam = null;
  }

  // Try to get team UUID from file route loader (but not full team data)
  let fileTeamUuid: string | null = null;
  try {
    const fileData = useFileRouteLoaderData();
    // Get team UUID from file data
    fileTeamUuid = fileData?.team?.uuid ?? null;
  } catch {
    fileTeamUuid = null;
  }

  // Use fetcher to load team data when we have UUID but no data (file context)
  const teamFetcher = useFetcher<GetTeamData>({ key: 'team-data-fetcher' });
  const teamUuid = dashboardTeam?.team.uuid ?? fileTeamUuid;
  const hasFetchedRef = useRef(false);

  // Reset fetch flag when team UUID changes
  useEffect(() => {
    hasFetchedRef.current = false;
    hasLoadedDataRef.current = false; // Reset loaded flag when team UUID changes
  }, [teamUuid]);

  // Load team data via fetcher if we're in file context and don't have team data
  useEffect(() => {
    if (teamUuid && !dashboardTeam && teamFetcher.state === 'idle' && !teamFetcher.data && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      // Load from the API route which returns team data directly
      teamFetcher.load(ROUTES.API.TEAM(teamUuid));
    }
  }, [teamUuid, dashboardTeam, teamFetcher]);

  // Keep previous team data to prevent flicker during reload
  const previousFetcherTeamRef = useRef<TeamData | null>(null);
  // Track if we've successfully loaded data at least once (to distinguish initial load from reloads)
  const hasLoadedDataRef = useRef(false);

  // Get team data from fetcher if available
  // The fetcher loads from the API route which returns GetTeamData
  const fetcherTeam: TeamData | null = useMemo(() => {
    if (!teamFetcher.data || typeof teamFetcher.data !== 'object') {
      // Return previous data if available to prevent flicker during reload
      return previousFetcherTeamRef.current;
    }
    if (
      'ok' in teamFetcher.data &&
      teamFetcher.data.ok === true &&
      'data' in teamFetcher.data &&
      teamFetcher.data.data
    ) {
      const newData = teamFetcher.data.data;
      previousFetcherTeamRef.current = newData;
      hasLoadedDataRef.current = true; // Mark that we've successfully loaded data
      return newData;
    }
    // Return previous data if current data is invalid
    return previousFetcherTeamRef.current;
  }, [teamFetcher.data]);

  // Get all fetchers to apply optimistic updates and detect action completions
  const fetchers = useFetchers();
  const previousActionCountRef = useRef(0);
  const reloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Track completed user deletions to maintain optimistic state until reload
  const completedDeleteUserIdsRef = useRef<Set<string>>(new Set());
  // Track completed user updates to maintain optimistic state until reload
  const completedUpdateUsersRef = useRef<Map<string, string>>(new Map()); // userId -> role
  // Track base data user IDs to detect when fresh data arrives
  const previousBaseUserIdsRef = useRef<string>('');

  // Track completed team name updates for optimistic UI persistence
  const completedTeamNameRef = useRef<string | null>(null);

  // Reload team data when team actions complete successfully
  useEffect(() => {
    // Reload for team actions to ensure data stays in sync
    const actionsNeedingReload = [
      'create-team-invite',
      'delete-team-invite',
      'update-team-user',
      'delete-team-user',
      'update-team',
    ];

    const completedActions = fetchers.filter((f) => {
      if (f.state !== 'idle' || !f.data || !isJsonObject(f.data) || !('ok' in f.data) || f.data.ok !== true) {
        return false;
      }
      if (!isJsonObject(f.json)) {
        return false;
      }
      const json = f.json as { intent?: string };
      if (!('intent' in json) || typeof json.intent !== 'string') {
        return false;
      }
      return actionsNeedingReload.includes(json.intent);
    });

    // Track completed user deletions for optimistic UI persistence
    const newCompletedDeletes = fetchers.filter((f) => {
      if (f.state !== 'idle' || !f.data || !isJsonObject(f.data) || !('ok' in f.data) || f.data.ok !== true) {
        return false;
      }
      return f.key?.startsWith('delete-user-');
    });
    newCompletedDeletes.forEach((f) => {
      const userId = f.key?.replace('delete-user-', '');
      if (userId) {
        completedDeleteUserIdsRef.current.add(userId);
      }
    });

    // Track completed user updates for optimistic UI persistence
    const newCompletedUpdates = fetchers.filter((f) => {
      if (f.state !== 'idle' || !f.data || !isJsonObject(f.data) || !('ok' in f.data) || f.data.ok !== true) {
        return false;
      }
      return f.key?.startsWith('update-user-') && isJsonObject(f.json) && 'role' in f.json;
    });
    newCompletedUpdates.forEach((f) => {
      const userId = f.key?.replace('update-user-', '');
      if (userId && isJsonObject(f.json) && 'role' in f.json) {
        completedUpdateUsersRef.current.set(userId, String(f.json.role));
      }
    });

    // Track completed team name updates for optimistic UI persistence
    const completedTeamUpdate = fetchers.find((f) => {
      if (f.state !== 'idle' || !f.data || !isJsonObject(f.data) || !('ok' in f.data) || f.data.ok !== true) {
        return false;
      }
      if (f.key !== 'update-team' || !isJsonObject(f.json)) {
        return false;
      }
      const json = f.json as { intent?: string; name?: string };
      return json.intent === 'update-team' && 'name' in json;
    });
    if (completedTeamUpdate && isJsonObject(completedTeamUpdate.json)) {
      const json = completedTeamUpdate.json as { name?: string };
      if (json.name) {
        completedTeamNameRef.current = String(json.name);
      }
    }

    const currentActionCount = completedActions.length;

    // In file context, reload via fetcher when team actions complete
    // In dashboard context, React Router handles revalidation automatically
    if (
      currentActionCount > previousActionCountRef.current &&
      teamUuid &&
      !dashboardTeam &&
      teamFetcher.state === 'idle'
    ) {
      // Clear any pending reload timeout
      if (reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current);
      }

      // Delay reload to let optimistic updates render smoothly and debounce multiple actions
      // Use a longer delay to ensure UI has settled before reloading
      reloadTimeoutRef.current = setTimeout(() => {
        // Only reload if fetcher is still idle (not already loading)
        if (teamFetcher.state === 'idle') {
          hasFetchedRef.current = false; // Reset so we can reload
          teamFetcher.load(ROUTES.API.TEAM(teamUuid));
          // Clear the completed refs once reload is triggered - fresh data will replace them
          completedDeleteUserIdsRef.current.clear();
          completedUpdateUsersRef.current.clear();
        }
      }, 800);
    }

    previousActionCountRef.current = currentActionCount;

    // Cleanup timeout on unmount
    return () => {
      if (reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current);
      }
    };
  }, [fetchers, teamUuid, dashboardTeam, teamFetcher]);

  // Clear completed action refs when base data changes (fresh data arrived)
  const baseData = dashboardTeam ?? fetcherTeam ?? null;
  const currentBaseUserIds = baseData?.users.map((u) => String(u.id)).join(',') ?? '';
  const currentBaseTeamName = baseData?.team.name ?? '';
  useEffect(() => {
    if (currentBaseUserIds && currentBaseUserIds !== previousBaseUserIdsRef.current) {
      previousBaseUserIdsRef.current = currentBaseUserIds;
      completedDeleteUserIdsRef.current.clear();
      completedUpdateUsersRef.current.clear();
    }
    // Clear team name ref when base data team name changes
    if (currentBaseTeamName && completedTeamNameRef.current === currentBaseTeamName) {
      completedTeamNameRef.current = null;
    }
  }, [currentBaseUserIds, currentBaseTeamName]);

  // Determine which data source to use and apply optimistic updates
  const teamData = useMemo(() => {
    if (!baseData) return null;

    // Apply optimistic updates from fetchers
    let optimisticData = { ...baseData };

    // Watch for team name updates (both in-progress and completed)
    const teamUpdateFetcher = fetchers.find((f) => {
      if (f.key !== 'update-team' || !isJsonObject(f.json)) {
        return false;
      }
      const json = f.json as { intent?: string; name?: string };
      return json.intent === 'update-team' && 'name' in json;
    });
    if (teamUpdateFetcher && teamUpdateFetcher.state !== 'idle' && isJsonObject(teamUpdateFetcher.json)) {
      // In-progress update
      const json = teamUpdateFetcher.json as { name?: string };
      if (json.name) {
        optimisticData = {
          ...optimisticData,
          team: { ...optimisticData.team, name: String(json.name) },
        };
      }
    } else if (completedTeamNameRef.current) {
      // Completed update that hasn't been reloaded yet
      optimisticData = {
        ...optimisticData,
        team: { ...optimisticData.team, name: completedTeamNameRef.current },
      };
    }

    // Watch for user role updates (both in-progress and completed)
    const updateFetchers = fetchers.filter(
      (f) => f.key?.startsWith('update-user-') && f.state !== 'idle' && isJsonObject(f.json)
    );
    optimisticData.users = optimisticData.users.map((user) => {
      // First check in-progress updates
      const userFetcher = updateFetchers.find((f) => f.key === `update-user-${user.id}`);
      if (userFetcher && isJsonObject(userFetcher.json) && 'role' in userFetcher.json) {
        return { ...user, role: userFetcher.json.role as typeof user.role };
      }
      // Then check completed updates that haven't been reloaded yet
      const completedRole = completedUpdateUsersRef.current.get(String(user.id));
      if (completedRole) {
        return { ...user, role: completedRole as typeof user.role };
      }
      return user;
    });

    // Watch for user deletions (both in-progress and completed)
    const deleteFetchers = fetchers.filter((f) => f.key?.startsWith('delete-user-') && f.state !== 'idle');
    const deletingUserIds = new Set([
      ...deleteFetchers.map((f) => f.key?.replace('delete-user-', '')).filter(Boolean),
      ...completedDeleteUserIdsRef.current,
    ]);
    if (deletingUserIds.size > 0) {
      optimisticData.users = optimisticData.users.filter((user) => !deletingUserIds.has(String(user.id)));
    }

    // Watch for invite deletions (optimistic)
    const deleteInviteFetchers = fetchers.filter(
      (f) => f.state !== 'idle' && isJsonObject(f.json) && 'intent' in f.json && f.json.intent === 'delete-team-invite'
    );
    if (deleteInviteFetchers.length > 0) {
      const deletingInviteIds = deleteInviteFetchers
        .map((f) => {
          if (isJsonObject(f.json) && 'inviteId' in f.json) {
            return String(f.json.inviteId);
          }
          return null;
        })
        .filter((id): id is string => id !== null);
      optimisticData.invites = optimisticData.invites.filter(
        (invite) => !deletingInviteIds.includes(String(invite.id))
      );
    }

    // Watch for invite creations (optimistic) - show pending invites
    // But only for invites that haven't been converted to users yet
    const createInviteFetchers = fetchers.filter(
      (f) =>
        isJsonObject(f.json) &&
        'intent' in f.json &&
        f.json.intent === 'create-team-invite' &&
        'email' in f.json &&
        'role' in f.json
    );

    // Separate pending (not yet completed) and completed invite fetchers
    const pendingInviteFetchers = createInviteFetchers.filter((f) => f.state !== 'idle');
    const completedInviteFetchers = createInviteFetchers.filter(
      (f) => f.state === 'idle' && f.data && isJsonObject(f.data) && 'ok' in f.data && f.data.ok === true
    );

    // Get emails of existing users to avoid duplicates
    const existingUserEmails = new Set(optimisticData.users.map((user) => user.email));

    // Get emails from completed invite actions - these should be removed from optimistic invites
    // since the server has processed them (either as invites or users)
    const completedInviteEmails = new Set(
      completedInviteFetchers
        .map((f) => {
          if (isJsonObject(f.json) && 'email' in f.json) {
            return String(f.json.email);
          }
          return null;
        })
        .filter((email): email is string => email !== null)
    );

    if (pendingInviteFetchers.length > 0) {
      const pendingInvites = pendingInviteFetchers
        .map((f, i) => {
          const json = f.json as { email: string; role: string };
          return {
            id: -i - 1, // Negative ID to avoid conflicts
            email: json.email,
            role: json.role as ApiTypes['/v0/teams/:uuid.GET.response']['invites'][0]['role'],
          };
        })
        // Filter out invites for emails that already exist as users
        // (This happens when inviting an existing user - server immediately adds them as a user)
        .filter((invite) => !existingUserEmails.has(invite.email));

      // Also filter out any existing invites with the same email to avoid duplicates
      const pendingInviteEmails = new Set(pendingInvites.map((inv) => inv.email));
      optimisticData.invites = [
        ...optimisticData.invites.filter((inv) => !pendingInviteEmails.has(inv.email)),
        ...pendingInvites,
      ];
    }

    // Remove optimistic invites that have been completed (server has processed them)
    if (completedInviteEmails.size > 0) {
      optimisticData.invites = optimisticData.invites.filter((invite) => !completedInviteEmails.has(invite.email));
    }

    // Ensure no duplicate users by email (do this before filtering invites by user emails)
    const seenUserEmails = new Set<string>();
    optimisticData.users = optimisticData.users.filter((user) => {
      if (seenUserEmails.has(user.email)) {
        return false;
      }
      seenUserEmails.add(user.email);
      return true;
    });

    // Also filter out any invites that match existing user emails (in case server added them as users)
    // This prevents showing both an invite and a user for the same email
    // Use the deduplicated user emails set
    optimisticData.invites = optimisticData.invites.filter((invite) => !seenUserEmails.has(invite.email));

    return optimisticData;
  }, [baseData, fetchers]);

  // Only show loading state on initial load, not on subsequent reloads
  // If we've loaded data before (hasLoadedDataRef) or have previous data (previousFetcherTeamRef),
  // we should not show loading state during reloads
  const isLoading =
    !dashboardTeam && teamFetcher.state !== 'idle' && !hasLoadedDataRef.current && !previousFetcherTeamRef.current;

  return {
    teamData: teamData ? { activeTeam: teamData } : null,
    isLoading,
  };
}
