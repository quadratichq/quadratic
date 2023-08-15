import fuzzysort from 'fuzzysort';
import { SheetController } from '../../../grid/controller/_sheetController';
import { PixiApp } from '../../../gridGL/pixiApp/PixiApp';
import { CommandPaletteListItemSharedProps } from './CommandPaletteListItem';
import BordersListItems from './ListItems/Borders';
import EditListItems from './ListItems/Edit';
import FileListItems from './ListItems/File';
import FormatListItems from './ListItems/Format';
import HelpListItems from './ListItems/Help';
import ImportListItems from './ListItems/Import';
import SheetListItems from './ListItems/Sheets';
import TextListItems from './ListItems/Text';
import ViewListItems from './ListItems/View';

interface Commands {
  label: string;
  Component: (props: CommandPaletteListItemSharedProps) => JSX.Element;
}

export const getCommandPaletteListItems = (props: {
  app: PixiApp;
  sheetController: SheetController;
  closeCommandPalette: Function;
  activeSearchValue: string;
  selectedListItemIndex: number;
  extraItems: Commands[];
  confirmDelete: () => void;
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
