import React from 'react';
import fuzzysort from 'fuzzysort';
import HelpListItems from './ListItems/Help';
import ViewListItems from './ListItems/View';
import FileListItems from './ListItems/File';
import BordersListItems from './ListItems/Borders';
import { CommandPaletteListItemSharedProps } from './CommandPaletteListItem';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';

interface ICommand {
  label: string;
  Component: (props: CommandPaletteListItemSharedProps) => JSX.Element;
}

const commands: Array<ICommand> = [...FileListItems, ...ViewListItems, ...BordersListItems, ...HelpListItems];

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

/* @TODO make these into individual components
export const commands = [
  {
    name: 'Copy',
    shortcut: 'C',
    shortcutModifiers: [KeyboardSymbols.Command],
  },
  {
    name: 'Paste',
    shortcut: 'V',
    shortcutModifiers: [KeyboardSymbols.Command],
  },
  {
    name: 'Cut',
    shortcut: 'X',
    shortcutModifiers: [KeyboardSymbols.Command],
    disabled: true,
  },
  {
    name: 'Undo',
    shortcut: 'Z',
    shortcutModifiers: [KeyboardSymbols.Command],
  },
  {
    name: 'Redo',
    shortcut: 'Z',
    shortcutModifiers: [KeyboardSymbols.Command, KeyboardSymbols.Shift],
  },
  
  {
    name: 'View: Show debug menu',
    icon: <Checkbox />,
  },
  // Make sure the zoom commands are in the same order as they are in the menu  
  {
    name: 'Import: CSV',
    disabled: true,
  },
  {
    name: 'Import: Excel',
    disabled: true,
  },
  {
    name: 'Text: Bold',
    icon: <FormatBold />,
    disabled: true,
  },
  {
    name: 'Text: Italicize',
    icon: <FormatItalic />,
    disabled: true,
  },
  {
    name: 'Text: Underline',
    icon: <FormatUnderlined />,
    disabled: true,
  },
  {
    name: 'Text: Change color',
    icon: <FormatColorText />,
    disabled: true,
  },
  {
    name: 'Text: Wrap text',
    disabled: true,
  },
  {
    name: 'Text: Wrap text overflow',
    disabled: true,
  },
  {
    name: 'Text: Wrap text clip',
    disabled: true,
  },
  {
    name: 'Text: Align left',
    icon: <FormatAlignLeft />,
    disabled: true,
  },
  {
    name: 'Text: Align center',
    icon: <FormatAlignCenter />,
    disabled: true,
  },
  {
    name: 'Text: Align right',
    icon: <FormatAlignRight />,
    disabled: true,
  },
  {
    name: 'Format: Fill color',
    icon: <FormatColorFill />,
    disabled: true,
  },
  {
    name: 'Format: Clear fill color',
    disabled: true,
  },
  {
    name: 'Format: Clear all',
    icon: <FormatClear />,
    disabled: true,
  },
] as IQuadraticCommand[];
*/
