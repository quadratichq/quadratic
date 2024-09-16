import {
  editorInteractionStateAtom,
  editorInteractionStatePermissionsAtom,
  editorInteractionStateShowCommandPaletteAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { Command } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { BordersHook } from '@/app/ui/menus/CommandPalette/commands/Borders';
import codeCommandGroup from '@/app/ui/menus/CommandPalette/commands/Code';
import columnRowCommandGroup from '@/app/ui/menus/CommandPalette/commands/ColumnRow';
import connectionsCommandGroup from '@/app/ui/menus/CommandPalette/commands/Connections';
import editCommandGroup from '@/app/ui/menus/CommandPalette/commands/Edit';
import fileCommandGroup from '@/app/ui/menus/CommandPalette/commands/File';
import formatCommandGroup from '@/app/ui/menus/CommandPalette/commands/Format';
import helpCommandGroup from '@/app/ui/menus/CommandPalette/commands/Help';
import importCommandGroup from '@/app/ui/menus/CommandPalette/commands/Import';
import getSheetCommandGroup from '@/app/ui/menus/CommandPalette/commands/Sheets';
import textCommandGroup from '@/app/ui/menus/CommandPalette/commands/Text';
import validationCommandGroup from '@/app/ui/menus/CommandPalette/commands/Validation';
import viewCommandGroup from '@/app/ui/menus/CommandPalette/commands/View';
import { useRootRouteLoaderData } from '@/routes/_root';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandList } from '@/shared/shadcn/ui/command';
import fuzzysort from 'fuzzysort';
import mixpanel from 'mixpanel-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

export const CommandPalette = () => {
  const showCommandPalette = useRecoilValue(editorInteractionStateShowCommandPaletteAtom);
  const { isAuthenticated } = useRootRouteLoaderData();
  const {
    userMakingRequest: { fileTeamPrivacy, teamPermissions },
  } = useFileRouteLoaderData();
  const permissions = useRecoilValue(editorInteractionStatePermissionsAtom);
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
  const [activeSearchValue, setActiveSearchValue] = useState<string>('');

  // Fn that closes the command palette and gets passed down to individual ListItems
  const closeCommandPalette = useCallback(() => {
    setEditorInteractionState((prev) => ({
      ...prev,
      showCellTypeMenu: false,
      showCommandPalette: false,
    }));
  }, [setEditorInteractionState]);

  const openDateFormat = useCallback(() => {
    setEditorInteractionState((prev) => ({
      ...prev,
      annotationState: 'date-format',
    }));
  }, [setEditorInteractionState]);

  useEffect(() => {
    mixpanel.track('[CommandPalette].open');
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
      borderCommandGroup,
      textCommandGroup,
      formatCommandGroup,
      sheetsCommandGroup,
      helpCommandGroup,
      codeCommandGroup,
      columnRowCommandGroup,
      validationCommandGroup,
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
      overlayProps={{
        onPointerDown: (e) => {
          e.preventDefault();
          e.stopPropagation();
          closeCommandPalette();
        },
      }}
    >
      <CommandInput
        value={activeSearchValue}
        onValueChange={setActiveSearchValue}
        placeholder="Search menus and commands…"
      />
      <CommandList>
        {commandGroups.map(({ heading, commands }) => {
          let filteredCommands: Array<Command & { fuzzysortResult: any }> = [];
          commands.forEach((command, i) => {
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
};
