// Note: this is a new pattern that should replace the old `actions.ts` file
import { ApiTypes, FilePermission, TeamPermission } from 'quadratic-shared/typesAndSchemas';

/**
 * Every action _may_ have an `isAvailable` key.
 *
 * If it doesn’t have that key, that means the action is available to any user.
 *
 * If it does have that key, that means that function _must_ be run to determine
 * whether that action (and its associated shortcuts) should be available to the
 * current user.
 */
type ActionAvailabilityArgs = {
  filePermissions: FilePermission[];
  isAuthenticated: boolean;
  teamPermissions: TeamPermission[] | undefined;
  fileTeamPrivacy: ApiTypes['/v0/files/:uuid.GET.response']['userMakingRequest']['fileTeamPrivacy'];
};

/**
 * Shared types for actions in the app that can be used across multiple locations,
 * e.g. the sidebar, command palette, file menu, and formatting bar.
 */
export type GenericAction = {
  label: string;
  run: (args?: any) => void;

  // We may need an optional `label[Context]` key ro provide a different label
  // depending on the context in which the action is being used.

  // We make this a reference to a component, so it must be called where it's used
  // allow us to pass additional props depending on context, e.g.
  //
  // ```
  // const { Icon } = action;
  // return `<Icon className="custom-style-class" />`
  // ```
  // define this type as a component
  Icon?: React.FC;
  isAvailable?: (args: ActionAvailabilityArgs) => boolean;
  keyboardShortcut?: string;
};
