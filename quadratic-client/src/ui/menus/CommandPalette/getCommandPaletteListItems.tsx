import fuzzysort from 'fuzzysort';
import { GenericAction } from '../../../actions';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
import { CommandPaletteListItemSharedProps } from './CommandPaletteListItem';
import FileListItems from './ListItems/File';

export interface Commands {
  label: string;
  keywords?: Array<string> | string;
  Component: (props: CommandPaletteListItemSharedProps) => JSX.Element;
  isAvailable?: GenericAction['isAvailable'];
}

export const getCommandPaletteListItems = (props: {
  isAuthenticated: boolean;
  permissions: EditorInteractionState['permissions'];
  closeCommandPalette: Function;
  activeSearchValue: string;
}): Array<JSX.Element> => {
  // @ts-expect-error
  const commands: Array<Commands> = [
    ...FileListItems,
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
  ];
  const { activeSearchValue, permissions, isAuthenticated, ...rest } = props;

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
    let addKeywords = '';
    if (keywords) {
      addKeywords += '|';
      if (Array.isArray(keywords)) {
        addKeywords += keywords.join(' ');
      } else {
        addKeywords += keywords;
      }
    }
    const result = fuzzysort.single(activeSearchValue, label + addKeywords);
    if (result) {
      out.push(
        <Component
          {...rest}
          key={label}
          // listItemIndex={listItemIndex}
          label={label}
          // fuzzysortResult={result}
          // addKeywords={addKeywords}
        />
      );
      // listItemIndex++;
    }
  });
  return out;
};
