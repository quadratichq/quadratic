import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import {
  editorInteractionStateAnnotationStateAtom,
  editorInteractionStatePermissionsAtom,
  editorInteractionStateShowCellTypeMenuAtom,
  editorInteractionStateShowCommandPaletteAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { keyboardShortcutEnumToDisplay } from '@/app/helpers/keyboardShortcutsDisplay';
import type { Command, CommandPaletteListItemDynamicProps } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { CommandPaletteListItem } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { BordersHook } from '@/app/ui/menus/CommandPalette/commands/Borders';
import codeCommandGroup from '@/app/ui/menus/CommandPalette/commands/Code';
import { columnCommandGroup, rowCommandGroup } from '@/app/ui/menus/CommandPalette/commands/ColumnRow';
import conditionalFormatCommandGroup from '@/app/ui/menus/CommandPalette/commands/ConditionalFormat';
import connectionsCommandGroup from '@/app/ui/menus/CommandPalette/commands/Connections';
import dataTableCommandGroup from '@/app/ui/menus/CommandPalette/commands/DataTable';
import editCommandGroup from '@/app/ui/menus/CommandPalette/commands/Edit';
import fileCommandGroup from '@/app/ui/menus/CommandPalette/commands/File';
import formatCommandGroup from '@/app/ui/menus/CommandPalette/commands/Format';
import helpCommandGroup from '@/app/ui/menus/CommandPalette/commands/Help';
import importCommandGroup from '@/app/ui/menus/CommandPalette/commands/Import';
import scheduledTasksCommandGroup from '@/app/ui/menus/CommandPalette/commands/ScheduledTasks';
import getSheetCommandGroup from '@/app/ui/menus/CommandPalette/commands/Sheets';
import textCommandGroup from '@/app/ui/menus/CommandPalette/commands/Text';
import validationCommandGroup from '@/app/ui/menus/CommandPalette/commands/Validation';
import viewCommandGroup from '@/app/ui/menus/CommandPalette/commands/View';
import { useRootRouteLoaderData } from '@/routes/_root';
import { useFileRouteLoaderDataRequired } from '@/shared/hooks/useFileRouteLoaderData';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandList } from '@/shared/shadcn/ui/command';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import fuzzysort from 'fuzzysort';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

export const CommandPalette = memo(() => {
  const [showCommandPalette, setShowCommandPalette] = useRecoilState(editorInteractionStateShowCommandPaletteAtom);
  const { isAuthenticated } = useRootRouteLoaderData();
  const {
    userMakingRequest: { fileTeamPrivacy, teamPermissions },
  } = useFileRouteLoaderDataRequired();
  const permissions = useRecoilValue(editorInteractionStatePermissionsAtom);
  const setShowCellTypeMenu = useSetRecoilState(editorInteractionStateShowCellTypeMenuAtom);
  const setAnnotationState = useSetRecoilState(editorInteractionStateAnnotationStateAtom);
  const [activeSearchValue, setActiveSearchValue] = useState<string>('');

  // Fn that closes the command palette and gets passed down to individual ListItems
  const closeCommandPalette = useCallback(() => {
    setShowCellTypeMenu(false);
    setShowCommandPalette(false);
  }, [setShowCellTypeMenu, setShowCommandPalette]);

  const openDateFormat = useCallback(() => {
    setAnnotationState('date-format');
  }, [setAnnotationState]);

  useEffect(() => {
    trackEvent('[CommandPalette].open');
  }, []);

  const borderCommandGroup = BordersHook();
  const sheetsCommandGroup = getSheetCommandGroup();
  const commandGroups = useMemo(
    () => [
      editCommandGroup,
      fileCommandGroup,
      viewCommandGroup,
      importCommandGroup,
      connectionsCommandGroup,
      scheduledTasksCommandGroup,
      borderCommandGroup,
      textCommandGroup,
      formatCommandGroup,
      sheetsCommandGroup,
      helpCommandGroup,
      codeCommandGroup,
      columnCommandGroup,
      rowCommandGroup,
      dataTableCommandGroup,
      validationCommandGroup,
      conditionalFormatCommandGroup,
    ],
    [borderCommandGroup, sheetsCommandGroup]
  );

  if (!showCommandPalette) {
    return null;
  }

  return (
    <CommandDialog
      dialogProps={{
        open: showCommandPalette,
        onOpenChange: closeCommandPalette,
      }}
      commandProps={{ shouldFilter: false }}
      overlayProps={{ onPointerDown: (e) => e.preventDefault() }}
    >
      <CommandInput
        value={activeSearchValue}
        onValueChange={setActiveSearchValue}
        placeholder="Search menus and commands…"
      />
      <CommandList>
        {commandGroups.map(({ heading, commands }) => {
          let filteredCommands: Array<Command & { fuzzysortResult: any }> = [];
          commands.forEach((commandOrAction) => {
            // Right now, we are in the process of centralizing all actions.
            // That means for each command palette item will either be:
            // 1) a `Command` type (the OLD way)
            // 2) an `Action` type (the new way)
            // Once we convert all actions to the new format, we can remove this
            // intermediate step of converting an `Action` to a `Command` and
            // just expect that they'll all be `Action` types.
            let command;
            if (typeof commandOrAction === 'string') {
              const actionSpec = defaultActionSpec[commandOrAction];
              command = {
                ...actionSpec,
                label: actionSpec.labelVerbose ? actionSpec.labelVerbose : actionSpec.label(),
                Component: (props: CommandPaletteListItemDynamicProps) => (
                  <CommandPaletteListItem
                    {...props}
                    // This works fine for `run` functions that don't require anything
                    // But how will we handle the case where we want some actions require
                    // different args to the `run` function?
                    // @ts-expect-error
                    action={actionSpec.run}
                    icon={'Icon' in actionSpec && actionSpec.Icon ? <actionSpec.Icon /> : null}
                    shortcut={keyboardShortcutEnumToDisplay(commandOrAction)}
                  />
                ),
              };
            } else {
              command = commandOrAction;
            }

            const { label, keywords, isAvailable } = command;

            // Is the command even available?
            if (
              isAvailable &&
              isAvailable({ filePermissions: permissions, isAuthenticated, teamPermissions, fileTeamPrivacy }) !== true
            ) {
              return;
            }

            // If there's no active search, return the command as is
            if (activeSearchValue.length === 0) {
              filteredCommands.push({ ...command, fuzzysortResult: null });
              return;
            }

            // If there's an active search, perform it and set the result.
            // Otherwise return null and we'll filter it out
            const results = fuzzysort.go(
              activeSearchValue,
              // We'll have it search the label, heading and label, and any extra keywords
              [label, heading + label, ...(keywords ? keywords : [])]
            );
            if (results.length > 0) {
              filteredCommands.push({ ...command, fuzzysortResult: results[0] });
            }
          });

          return filteredCommands.length > 0 ? (
            <CommandGroup key={heading} heading={heading}>
              {filteredCommands.map(({ label, fuzzysortResult, Component }) => (
                <Component
                  key={`${heading}__${label}`}
                  value={`${heading}__${label}`}
                  label={label}
                  fuzzysortResult={fuzzysortResult}
                  closeCommandPalette={closeCommandPalette}
                  openDateFormat={openDateFormat}
                />
              ))}
            </CommandGroup>
          ) : null;
        })}
        <CommandEmpty>No results found.</CommandEmpty>
      </CommandList>
    </CommandDialog>
  );
});
