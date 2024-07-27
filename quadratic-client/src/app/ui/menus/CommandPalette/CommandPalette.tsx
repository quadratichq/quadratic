import fuzzysort from 'fuzzysort';
import mixpanel from 'mixpanel-browser';
import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';

import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import type { Command } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { BordersHook } from '@/app/ui/menus/CommandPalette/commands/Borders';
import codeCommandGroup from '@/app/ui/menus/CommandPalette/commands/Code';
import { columnRowCommandGroup } from '@/app/ui/menus/CommandPalette/commands/ColumnRow';
import connectionsCommandGroup from '@/app/ui/menus/CommandPalette/commands/Connections';
import editCommandGroup from '@/app/ui/menus/CommandPalette/commands/Edit';
import fileCommandGroup from '@/app/ui/menus/CommandPalette/commands/File';
import formatCommandGroup from '@/app/ui/menus/CommandPalette/commands/Format';
import helpCommandGroup from '@/app/ui/menus/CommandPalette/commands/Help';
import importCommandGroup from '@/app/ui/menus/CommandPalette/commands/Import';
import searchCommandGroup from '@/app/ui/menus/CommandPalette/commands/Search';
import getSheetCommandGroup from '@/app/ui/menus/CommandPalette/commands/Sheets';
import textCommandGroup from '@/app/ui/menus/CommandPalette/commands/Text';
import viewCommandGroup from '@/app/ui/menus/CommandPalette/commands/View';
import { useRootRouteLoaderData } from '@/routes/_root';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandList } from '@/shared/shadcn/ui/command';

export const CommandPalette = () => {
  const { isAuthenticated } = useRootRouteLoaderData();
  const {
    userMakingRequest: { fileTeamPrivacy, teamPermissions },
  } = useFileRouteLoaderData();
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const [activeSearchValue, setActiveSearchValue] = useState<string>('');
  const { permissions } = editorInteractionState;

  // Fn that closes the command palette and gets passed down to individual ListItems
  const closeCommandPalette = () => {
    setEditorInteractionState((state) => ({
      ...state,
      showCellTypeMenu: false,
      showCommandPalette: false,
    }));
  };

  useEffect(() => {
    mixpanel.track('[CommandPalette].open');
  }, []);

  const borderCommandGroup = BordersHook();

  const commandGroups = [
    editCommandGroup,
    fileCommandGroup,
    viewCommandGroup,
    importCommandGroup,
    connectionsCommandGroup,
    borderCommandGroup,
    textCommandGroup,
    formatCommandGroup,
    getSheetCommandGroup(),
    helpCommandGroup,
    codeCommandGroup,
    searchCommandGroup,
    columnRowCommandGroup,
  ];

  return (
    <CommandDialog
      dialogProps={{ open: editorInteractionState.showCommandPalette, onOpenChange: closeCommandPalette }}
      commandProps={{ shouldFilter: false }}
    >
      <CommandInput
        value={activeSearchValue}
        onValueChange={setActiveSearchValue}
        placeholder="Search menus and commands…"
      />
      <CommandList>
        {commandGroups.map(({ heading, commands }) => {
          let filteredCommands: Array<Command & { fuzzysortResult: any }> = [];
          commands.forEach((command) => {
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
