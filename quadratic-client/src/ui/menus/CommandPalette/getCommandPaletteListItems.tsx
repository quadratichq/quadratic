import fuzzysort from 'fuzzysort';
import { GenericAction } from '../../../actions';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
import { CommandPaletteListItemSharedProps } from './CommandPaletteListItem';

export interface Commands {
  label: string;
  keywords?: Array<string>;
  Component: (props: CommandPaletteListItemSharedProps) => JSX.Element;
  isAvailable?: GenericAction['isAvailable'];
}

export const getCommandPaletteListItems = (props: {
  isAuthenticated: boolean;
  permissions: EditorInteractionState['permissions'];
  closeCommandPalette: Function;
  activeSearchValue: string;
  commands: Array<Commands>;
}): Array<JSX.Element> => {
  // const commands: Array<Commands> = [
  //   ...FileListItems,
  //   ...EditListItems,
  // ...ViewListItems,
  //   ...ImportListItems,
  //   ...BordersListItems,
  // ...TextListItems,
  // ...FormatListItems,

  //   ...SheetListItems(),
  //   ...HelpListItems,
  // ...CodeItems,
  // ...SearchItems,
  // ];
  const { activeSearchValue, permissions, isAuthenticated, commands, ...rest } = props;

  // First, get everything that's considered available
  let filteredCommands = commands.filter((action) =>
    action.isAvailable ? action.isAvailable(permissions, isAuthenticated) : true
  );

  // If there's no active search query, return everything
  if (!activeSearchValue) {
    return filteredCommands.map(({ label, Component }, i) => <Component {...rest} key={label} label={label} />);
  }

  // Otherwise, perform a fuzzysort search and pass along the info to each
  // component for rendering
  let out: any = [];
  // let listItemIndex = 0;
  filteredCommands.forEach(({ label, keywords, Component }, i) => {
    const results = fuzzysort.go(activeSearchValue, [label, ...(keywords ? keywords : [])]);
    console.log(results, results.total, results.length);
    if (results.total > 0) {
      console.warn('has result');
      out.push(<Component {...rest} key={label} label={label} fuzzysortResult={results[0]} />);
      // listItemIndex++;
    }
  });
  return out;
};
