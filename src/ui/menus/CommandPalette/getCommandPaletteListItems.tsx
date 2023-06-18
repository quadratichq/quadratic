import fuzzysort from 'fuzzysort';
import HelpListItems from './ListItems/Help';
import ViewListItems from './ListItems/View';
import FileListItems from './ListItems/File';
import ImportListItems from './ListItems/Import';
import EditListItems from './ListItems/Edit';
import FormatListItems from './ListItems/Format';
import BordersListItems from './ListItems/Borders';
import SheetListItems from './ListItems/Sheets';
import TextListItems from './ListItems/Text';
import { CommandPaletteListItemSharedProps } from './CommandPaletteListItem';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { SheetController } from '../../../grid/controller/sheetController';
import { PixiApp } from '../../../gridGL/pixiApp/PixiApp';

interface Commands {
  label: string;
  Component: (props: CommandPaletteListItemSharedProps) => JSX.Element;
}

export const getCommandPaletteListItems = (props: {
  sheetController: SheetController;
  app: PixiApp;
  interactionState: GridInteractionState;
  closeCommandPalette: Function;
  activeSearchValue: string;
  selectedListItemIndex: number;
  extraItems: Commands[];
}): Array<JSX.Element> => {
  const { activeSearchValue, extraItems, ...rest } = props;

  const commands: Array<Commands> = [
    ...FileListItems,
    ...EditListItems,
    ...ViewListItems,
    ...ImportListItems,
    ...BordersListItems,
    ...TextListItems,
    ...FormatListItems,
    ...SheetListItems,
    ...extraItems,
    ...HelpListItems,
  ];

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
