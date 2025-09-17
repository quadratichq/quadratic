// Note: this is a new pattern that should replace the old `actions.ts` file
import type { Action } from '@/app/actions/actions';
import type { EditActionArgs } from '@/app/actions/editActionsSpec';
import type { FileActionArgs } from '@/app/actions/fileActionsSpec';
import type { FormatActionArgs } from '@/app/actions/formatActionsSpec';
import type { IconComponent } from '@/shared/components/Icons';
import type { ApiTypes, FilePermission, TeamPermission } from 'quadratic-shared/typesAndSchemas';

/**
 * Every action _may_ have an `isAvailable` key.
 *
 * If it doesn’t have that key, that means the action is available to any user.
 *
 * If it does have that key, that means that function _must_ be run to determine
 * whether that action (and its associated shortcuts) should be available to the
 * current user.
 */
export type ActionAvailabilityArgs = {
  filePermissions: FilePermission[];
  isAuthenticated: boolean;
  teamPermissions: TeamPermission[] | undefined;
  fileTeamPrivacy: ApiTypes['/v0/files/:uuid.GET.response']['userMakingRequest']['fileTeamPrivacy'];
};

/**
 * Shared types for actions in the app that can be used across multiple locations,
 * e.g. the sidebar, command palette, file menu, and formatting bar.
 */
export type ActionSpec<ActionArgsType> = {
  label: () => string;
  run: (args: ActionArgsType) => void;

  // Used for contexts where we want to show a longer label
  labelVerbose?: string;

  // We make this a reference to a component, so it must be called where it's used
  // allow us to pass additional props depending on context, e.g.
  //
  // ```
  // const { Icon } = action;
  // return `<Icon className="custom-style-class" />`
  // ```
  Icon?: IconComponent;

  // use a checkbox instead of an Icon
  checkbox?: boolean | (() => boolean);

  // defaultOption will bold the name (this is usually used to indicate that
  // double clicking will trigger the action)
  defaultOption?: boolean;

  // function to show/hide the action
  isAvailable?: (args: ActionAvailabilityArgs) => boolean;

  // function to disable the action
  isDisabled?: () => boolean;

  // Used for command palette search
  keywords?: string[];
};

export type ActionSpecRecord = {
  [K in Action]: ActionSpec<K extends keyof ActionArgs ? ActionArgs[K] : void>;
};

// Define the possible argument types for each action
export type ActionArgs = EditActionArgs & FileActionArgs & FormatActionArgs;
