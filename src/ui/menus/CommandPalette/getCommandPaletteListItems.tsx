import React from 'react';
import fuzzysort from 'fuzzysort';
import HelpListItems from './ListItems/Help';
import ViewListItems from './ListItems/View';
import FileListItems from './ListItems/File';
import EditListItems from './ListItems/Edit';
import BordersListItems from './ListItems/Borders';
import { CommandPaletteListItemSharedProps } from './CommandPaletteListItem';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';

interface Commands {
  label: string;
  Component: (props: CommandPaletteListItemSharedProps) => JSX.Element;
}

const commands: Array<Commands> = [
  ...FileListItems,
  ...EditListItems,
  ...ViewListItems,
  ...BordersListItems,
  ...HelpListItems,
];

export const getCommandPaletteListItems = (props: {
  sheetController: any;
  app: any;
  interactionState: GridInteractionState;
  closeCommandPalette: Function;
  activeSearchValue: string;
  selectedListItemIndex: number;
}): Array<JSX.Element> => {
  const { activeSearchValue, ...rest } = props;

  // If there's no active search query, return everything
  if (!activeSearchValue) {
    return commands.map(({ label, Component }, i) => (
      <Component {...rest} key={label} listItemIndex={i} label={label} />
    ));
  }

  // Otherwise, perform a fuzzysort search and pass along the info to each
  // component for rendering
  let out: any = [];
  let listItemIndex = 0;
  commands.forEach(({ label, Component }, i) => {
    const result = fuzzysort.single(activeSearchValue, label);
    if (result) {
      out.push(
        <Component {...rest} key={label} listItemIndex={listItemIndex} label={label} fuzzysortResult={result} />
      );
      listItemIndex++;
    }
  });

  return out;
};
