import {
  BorderAllIcon,
  BorderBottomIcon,
  BorderHorizontalIcon,
  BorderInnerIcon,
  BorderLeftIcon,
  BorderNoneIcon,
  BorderOuterIcon,
  BorderRightIcon,
  BorderTopIcon,
  BorderVerticalIcon,
} from '@/ui/icons/radix';

import { hasPermissionToEditFile } from '../../../../actions';
import { BorderSelection } from '../../../../quadratic-core/quadratic_core';
import { ChangeBorder, useBorders } from '../../TopBar/SubMenus/useBorders';
import { CommandGroup, CommandPaletteListItem } from '../CommandPaletteListItem';

const commands: CommandGroup = {
  heading: 'Borders',
  commands: [
    // Convenience to generate all the border component variations
    ...[
      {
        label: 'Border all',
        changeBordersArgs: { borderAll: true },
        icon: <BorderAllIcon />,
      },
      {
        label: 'Border outer',
        changeBordersArgs: { selection: BorderSelection.Outer },
        icon: <BorderOuterIcon />,
      },
      {
        label: 'Border inner',
        changeBordersArgs: { selection: BorderSelection.Inner },
        icon: <BorderInnerIcon />,
      },
      {
        label: 'Border vertical',
        changeBordersArgs: { selection: BorderSelection.Vertical },
        icon: <BorderVerticalIcon />,
      },
      {
        label: 'Border horizontal',
        changeBordersArgs: { selection: BorderSelection.Horizontal },
        icon: <BorderHorizontalIcon />,
      },
      {
        label: 'Border left',
        changeBordersArgs: { selection: BorderSelection.Left },
        icon: <BorderLeftIcon />,
      },
      {
        label: 'Border right',
        changeBordersArgs: { selection: BorderSelection.Right },
        icon: <BorderRightIcon />,
      },
      {
        label: 'Border top',
        changeBordersArgs: { selection: BorderSelection.Top },
        icon: <BorderTopIcon />,
      },
      {
        label: 'Border bottom',
        changeBordersArgs: { selection: BorderSelection.Bottom },
        icon: <BorderBottomIcon />,
      },
    ].map(generateListItem),
    {
      label: 'Border none',
      keywords: ['Remove borders', 'Clear borders'],
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        const { clearBorders } = useBorders();
        return (
          <CommandPaletteListItem
            {...props}
            icon={<BorderNoneIcon />}
            action={() => {
              clearBorders();
            }}
          />
        );
      },
    },
    // We can uncomment these once we figure out how border styles will work
    // ...[
    //   { label: 'Borders: Style thin', icon: <BorderThin />, changeBordersArgs: { type: BorderType.line1 } },
    //   { label: 'Borders: Style medium', icon: <BorderMedium />, changeBordersArgs: { type: BorderType.line2 } },
    //   { label: 'Borders: Style thick', icon: <BorderThick />, changeBordersArgs: { type: BorderType.line3 } },
    //   { label: 'Borders: Style dashed', icon: <BorderDashed />, changeBordersArgs: { type: BorderType.dashed } },
    //   { label: 'Borders: Style dotted', icon: <BorderDotted />, changeBordersArgs: { type: BorderType.dotted } },
    //   { label: 'Borders: Style double', icon: <BorderDouble />, changeBordersArgs: { type: BorderType.double } },
    // ].map(generateListItem),
  ],
};

function generateListItem({
  label,
  icon,
  changeBordersArgs,
  keywords,
}: {
  label: string;
  icon?: JSX.Element;
  keywords?: string[];
  changeBordersArgs: ChangeBorder;
}) {
  const item: CommandGroup['commands'][0] = {
    label,
    isAvailable: hasPermissionToEditFile,
    ...(keywords ? { keywords } : {}),
    Component: (props) => {
      const { changeBorders } = useBorders();
      return (
        <CommandPaletteListItem
          {...props}
          action={() => {
            changeBorders(changeBordersArgs);
          }}
          {...(icon ? { icon } : {})}
        />
      );
    },
  };
  return item;
}

export default commands;
