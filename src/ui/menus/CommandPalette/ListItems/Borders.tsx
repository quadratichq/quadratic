import {
  BorderAll,
  BorderBottom,
  BorderClear,
  BorderHorizontal,
  BorderInner,
  BorderLeft,
  BorderOuter,
  BorderRight,
  BorderTop,
  BorderVertical,
} from '@mui/icons-material';
import { isEditorOrAbove } from '../../../../actions';
import { BorderSelection } from '../../../../quadratic-core/quadratic_core';
import { ChangeBorder, useBorders } from '../../TopBar/SubMenus/useBorders';
import { CommandPaletteListItem, CommandPaletteListItemSharedProps } from '../CommandPaletteListItem';

const ListItems = [
  // Convenience to generate all the border component variations
  ...[
    { label: 'Borders: Apply all', icon: <BorderAll />, changeBordersArgs: { borderAll: true } },
    {
      label: 'Borders: Apply outer',
      icon: <BorderOuter />,
      changeBordersArgs: { selection: BorderSelection.Outer },
    },
    {
      label: 'Borders: Apply inner',
      icon: <BorderInner />,
      changeBordersArgs: { selection: BorderSelection.Inner },
    },
    {
      label: 'Borders: Apply vertical',
      icon: <BorderVertical />,
      changeBordersArgs: { selection: BorderSelection.Vertical },
    },
    {
      label: 'Borders: Apply horizontal',
      icon: <BorderHorizontal />,
      changeBordersArgs: { selection: BorderSelection.Horizontal },
    },
    {
      label: 'Borders: Apply left',
      icon: <BorderLeft />,
      changeBordersArgs: { selection: BorderSelection.Left },
    },
    {
      label: 'Borders: Apply right',
      icon: <BorderRight />,
      changeBordersArgs: { selection: BorderSelection.Right },
    },
    {
      label: 'Borders: Apply top',
      icon: <BorderTop />,
      changeBordersArgs: { selection: BorderSelection.Top },
    },
    {
      label: 'Borders: Apply bottom',
      icon: <BorderBottom />,
      changeBordersArgs: { selection: BorderSelection.Bottom },
    },
  ].map(generateListItem),
  {
    label: 'Borders: Clear all',
    isAvailable: isEditorOrAbove,
    Component: (props: CommandPaletteListItemSharedProps) => {
      const { clearBorders } = useBorders();
      return (
        <CommandPaletteListItem
          {...props}
          action={() => {
            clearBorders();
          }}
          icon={<BorderClear />}
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
];

function generateListItem({
  label,
  icon,
  changeBordersArgs,
}: {
  label: string;
  icon?: JSX.Element;
  changeBordersArgs: ChangeBorder;
}) {
  return {
    label,
    isAvailable: isEditorOrAbove,
    Component: (props: CommandPaletteListItemSharedProps) => {
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
}

export default ListItems;
