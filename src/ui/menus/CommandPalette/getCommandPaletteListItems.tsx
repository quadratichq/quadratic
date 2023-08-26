import fuzzysort from 'fuzzysort';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { SheetController } from '../../../grid/controller/sheetController';
import { PixiApp } from '../../../gridGL/pixiApp/PixiApp';
import { CommandPaletteListItemSharedProps } from './CommandPaletteListItem';
import BordersListItems from './ListItems/Borders';
import EditListItems from './ListItems/Edit';
import FileListItems from './ListItems/File';
import FormatListItems from './ListItems/Format';
import HelpListItems from './ListItems/Help';
import ImportListItems from './ListItems/Import';
import TextListItems from './ListItems/Text';
import ViewListItems from './ListItems/View';

interface Commands {
  label: string;
  Component: (props: CommandPaletteListItemSharedProps) => JSX.Element;
  permissions?: Array<EditorInteractionState['permission']>;
}

const commands: Array<Commands> = [
  ...FileListItems,
  ...EditListItems,
  ...ViewListItems,
  ...ImportListItems,
  ...BordersListItems,
  ...TextListItems,
  ...FormatListItems,
  ...HelpListItems,
];

export const getCommandPaletteListItems = (props: {
  permission: EditorInteractionState['permission'];
  sheetController: SheetController;
  app: PixiApp;
  interactionState: GridInteractionState;
  closeCommandPalette: Function;
  activeSearchValue: string;
  selectedListItemIndex: number;
}): Array<JSX.Element> => {
  const { activeSearchValue, permission, ...rest } = props;

  let filteredCommands = commands.filter(({ permissions }) => (permissions ? permissions.includes(permission) : true));

  // If there's no active search query, return everything
  if (!activeSearchValue) {
    return filteredCommands.map(({ label, Component }, i) => (
      <Component {...rest} key={label} listItemIndex={i} label={label} />
    ));
  }

  // Otherwise, perform a fuzzysort search and pass along the info to each
  // component for rendering
  let out: any = [];
  let listItemIndex = 0;
  filteredCommands.forEach(({ label, Component }, i) => {
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
