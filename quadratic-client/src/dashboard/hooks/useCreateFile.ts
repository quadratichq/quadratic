import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { ROUTES } from '@/shared/constants/routes';
import { useCallback, useMemo } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router';

/**
 * Unified hook for creating new files in the dashboard.
 *
 * Derives `teamUuid`, `isPrivate`, and `folderUuid` from the current route
 * so that every "create file" action behaves consistently regardless of which
 * button triggers it.
 *
 * Call `createFile()` with no arguments to use the current route context,
 * or pass overrides when the intent differs (e.g. the sidebar "Team Files +"
 * always creates a team file at root regardless of the current view).
 */
export function useCreateFile() {
  const {
    activeTeam: {
      team: { uuid: teamUuid },
      folders,
    },
  } = useDashboardRouteLoaderData();

  const location = useLocation();
  const [searchParams] = useSearchParams();
  const params = useParams<{ folderUuid?: string }>();

  const context = useMemo(() => {
    const folderUuid = params.folderUuid;

    let isPrivate: boolean;

    if (folderUuid) {
      // Inside a folder – derive privacy from the root ancestor's ownership.
      const folder = folders.find((f) => f.uuid === folderUuid);
      if (folder) {
        let current = folder;
        while (current.parentFolderUuid) {
          const parent = folders.find((f) => f.uuid === current.parentFolderUuid);
          if (!parent) break;
          current = parent;
        }
        isPrivate = current.ownerUserId !== null;
      } else {
        isPrivate = true;
      }
    } else if (location.pathname.includes('/drive/private')) {
      isPrivate = true;
    } else if (location.pathname.includes('/drive/team')) {
      isPrivate = false;
    } else {
      // Home or other view – respect the ?type= filter if present.
      const typeParam = searchParams.get('type');
      isPrivate = typeParam !== 'team';
    }

    return { teamUuid, isPrivate, folderUuid };
  }, [teamUuid, folders, location.pathname, params.folderUuid, searchParams]);

  /**
   * Navigate to create a new file.
   *
   * Any field in `overrides` replaces the value derived from the current route.
   * Pass `folderUuid: null` to explicitly create at the root (no folder).
   */
  const createFile = useCallback(
    (overrides?: { isPrivate?: boolean; folderUuid?: string | null }) => {
      const isPrivate = overrides?.isPrivate ?? context.isPrivate;
      const folderUuid =
        overrides?.folderUuid !== undefined ? (overrides.folderUuid ?? undefined) : context.folderUuid;

      window.location.href = ROUTES.CREATE_FILE(context.teamUuid, {
        private: isPrivate,
        folderUuid,
      });
    },
    [context]
  );

  return { teamUuid: context.teamUuid, isPrivate: context.isPrivate, folderUuid: context.folderUuid, createFile };
}
