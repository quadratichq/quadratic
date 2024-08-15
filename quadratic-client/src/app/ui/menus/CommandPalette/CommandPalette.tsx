import { useRootRouteLoaderData } from '@/routes/_root';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandList } from '@/shared/shadcn/ui/command';
import fuzzysort from 'fuzzysort';
import mixpanel from 'mixpanel-browser';
import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { Command } from './CommandPaletteListItem';
import { BordersHook } from './commands/Borders';
import codeCommandGroup from './commands/Code';
import { columnRowCommandGroup } from './commands/ColumnRow';
import connectionsCommandGroup from './commands/Connections';
import editCommandGroup from './commands/Edit';
import fileCommandGroup from './commands/File';
import formatCommandGroup from './commands/Format';
import helpCommandGroup from './commands/Help';
import importCommandGroup from './commands/Import';
import searchCommandGroup from './commands/Search';
import getSheetCommandGroup from './commands/Sheets';
import textCommandGroup from './commands/Text';
import viewCommandGroup from './commands/View';
import { validationCommandGroup } from './commands/Validation';

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

  const openDateFormat = () => {
    setEditorInteractionState((state) => ({
      ...state,
      annotationState: 'date-format',
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
    validationCommandGroup,
  ];

  return (
    <CommandDialog
      dialogProps={{
        open: editorInteractionState.showCommandPalette,
        onOpenChange: closeCommandPalette,
      }}
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
